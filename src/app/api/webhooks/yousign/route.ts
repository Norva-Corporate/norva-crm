import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  contratPdfFilename,
  contratProofStoragePath,
  contratSignedPdfStoragePath,
} from "@/lib/contrats/generate-pdf";
import { insertContratActivity } from "@/lib/contrats/server";
import type { ContratActivityType } from "@/lib/contrats/server";
import {
  downloadAuditTrail,
  downloadSignedDocument,
  fetchSignatureRequest,
} from "@/lib/yousign";
import {
  sendContratSignedClient,
  sendContratSignedInternal,
} from "@/lib/contrats/notify";
import type { ContratClientSnapshot } from "@/lib/contrats/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "contrats";

function readSignatureHeader(req: Request): string {
  const h =
    req.headers.get("x-yousign-signature-256") ??
    req.headers.get("X-Yousign-Signature-256") ??
    "";
  return h.replace(/^sha256=/i, "").trim();
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex) return false;
  // length first to short-circuit
  if (aHex.length !== bHex.length) return false;
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface YousignWebhookPayload {
  // Le nom exact du champ d'event id peut varier ; on tente plusieurs clés
  // pour rester résilient à des évolutions mineures de la doc v3.
  id?: string;
  event_id?: string;
  event_name?: string;
  type?: string;
  data?: {
    signature_request?: {
      id?: string;
      status?: string;
    };
    signer?: {
      id?: string;
      status?: string;
    };
  };
}

function extractEventId(payload: YousignWebhookPayload): string | null {
  return payload.event_id ?? payload.id ?? null;
}
function extractEventName(payload: YousignWebhookPayload): string | null {
  return payload.event_name ?? payload.type ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("[webhook/yousign] missing YOUSIGN_WEBHOOK_SECRET env");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  // 1. Raw body avant tout parse JSON
  const raw = await req.text();

  // 2. HMAC SHA256 timing-safe
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw, "utf8")
    .digest("hex");
  const provided = readSignatureHeader(req);
  if (!timingSafeEqualHex(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 3. Parse JSON
  let payload: YousignWebhookPayload;
  try {
    payload = JSON.parse(raw) as YousignWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventId = extractEventId(payload);
  const eventName = extractEventName(payload);
  const signatureRequestId = payload.data?.signature_request?.id;

  if (!eventId || !eventName || !signatureRequestId) {
    console.warn(
      "[webhook/yousign] missing fields",
      JSON.stringify({ eventId, eventName, signatureRequestId })
    );
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();

  // 4. Trouver le contrat lié
  const { data: contrat, error: cErr } = await service
    .from("contrats")
    .select(
      "id, ref, statut, signed_pdf_path, proof_path, client_snapshot, montant_total, created_by"
    )
    .eq("yousign_signature_request_id", signatureRequestId)
    .maybeSingle();
  if (cErr) {
    console.error("[webhook/yousign] contrat lookup error:", cErr);
    return NextResponse.json({ error: "lookup error" }, { status: 500 });
  }
  if (!contrat) {
    // Inconnu — on log + 200 (Yousign n'aura pas à retry)
    console.warn(
      "[webhook/yousign] no contrat for signature_request_id",
      signatureRequestId
    );
    return NextResponse.json({ ok: true });
  }

  // 5. Idempotence : tenter d'insérer l'event ; si conflit → déjà traité
  const { data: insertedEvent, error: insertErr } = await service
    .from("contrat_events")
    .upsert(
      {
        contrat_id: contrat.id,
        yousign_event_id: eventId,
        event_name: eventName,
        payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "yousign_event_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (insertErr) {
    console.error("[webhook/yousign] contrat_events insert error:", insertErr);
    // 500 → Yousign retry
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  if (!insertedEvent) {
    // Event déjà traité → idempotent 200
    return NextResponse.json({ ok: true, deduped: true });
  }

  // 6. Routage par event_name
  try {
    if (eventName === "signature_request.done") {
      await handleSigned(service, contrat, signatureRequestId);
    } else if (eventName === "signature_request.expired") {
      await handleStatusChange(service, contrat, "expire", "contract_expired");
    } else if (
      eventName === "signer.declined" ||
      eventName === "signature_request.declined" ||
      eventName === "signer.refused"
    ) {
      await handleStatusChange(service, contrat, "refuse", "contract_refused");
    }
    // signature_request.activated → log uniquement (déjà loggé via upsert event)
  } catch (err) {
    console.error("[webhook/yousign] handler error:", err);
    // 500 pour que Yousign retry. L'idempotence empêchera les doubles écritures.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleStatusChange(
  service: ReturnType<typeof createServiceClient>,
  contrat: { id: string; ref: string },
  newStatus: "expire" | "refuse",
  activityType: ContratActivityType
) {
  await service
    .from("contrats")
    .update({ statut: newStatus })
    .eq("id", contrat.id);
  await insertContratActivity(service, contrat.id, activityType, {
    ref: contrat.ref,
  });
}

async function handleSigned(
  service: ReturnType<typeof createServiceClient>,
  contrat: {
    id: string;
    ref: string;
    client_snapshot: unknown;
    montant_total: number | string;
  },
  signatureRequestId: string
) {
  // 1. Récupérer la liste des documents pour trouver le signable
  const sr = await fetchSignatureRequest(signatureRequestId);
  const signable = sr.documents?.find(
    (d) => !d.nature || d.nature === "signable_document"
  );
  if (!signable) {
    throw new Error("No signable document on signature_request");
  }

  // 2. Télécharger PDF signé + dossier de preuve
  const signedPdf = await downloadSignedDocument(signatureRequestId, signable.id);
  let proof: Buffer | null = null;
  try {
    proof = await downloadAuditTrail(signatureRequestId);
  } catch (err) {
    console.error(
      "[webhook/yousign] downloadAuditTrail failed (continuing):",
      err
    );
  }

  // 3. Upload Storage
  const signedPath = contratSignedPdfStoragePath(contrat.id);
  const { error: upSignedErr } = await service.storage
    .from(BUCKET)
    .upload(signedPath, signedPdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upSignedErr) throw new Error(`upload signed: ${upSignedErr.message}`);

  let proofPath: string | null = null;
  if (proof) {
    proofPath = contratProofStoragePath(contrat.id);
    const { error: upProofErr } = await service.storage
      .from(BUCKET)
      .upload(proofPath, proof, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upProofErr) {
      console.error(
        "[webhook/yousign] proof upload failed:",
        upProofErr.message
      );
      proofPath = null;
    }
  }

  // 4. Update contrat
  const signedAt = new Date().toISOString();
  await service
    .from("contrats")
    .update({
      statut: "signe",
      signed_at: signedAt,
      signed_pdf_path: signedPath,
      proof_path: proofPath,
    })
    .eq("id", contrat.id);

  await insertContratActivity(service, contrat.id, "contract_signed", {
    ref: contrat.ref,
    signed_pdf_path: signedPath,
    proof_path: proofPath,
  });

  // 5. Notifications MailerSend (fire-and-forget)
  const client = contrat.client_snapshot as ContratClientSnapshot;
  const montant = Number(contrat.montant_total);
  const ctx = {
    contratId: contrat.id,
    ref: contrat.ref,
    client,
    montant_total: montant,
    signedAt,
  };
  await Promise.all([
    sendContratSignedInternal(ctx).catch((e) =>
      console.error("[webhook/yousign] notif internal failed:", e)
    ),
    sendContratSignedClient(
      ctx,
      signedPdf,
      contratPdfFilename({ id: contrat.id, ref: contrat.ref }).replace(
        /\.pdf$/,
        "-signe.pdf"
      )
    ).catch((e) =>
      console.error("[webhook/yousign] notif client failed:", e)
    ),
  ]);
}
