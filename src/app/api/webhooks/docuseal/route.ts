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
  downloadAuditLog,
  downloadSignedPdf,
} from "@/lib/docuseal";
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
    req.headers.get("x-docuseal-signature") ??
    req.headers.get("X-Docuseal-Signature") ??
    req.headers.get("X-DocuSeal-Signature") ??
    "";
  return h.replace(/^sha256=/i, "").trim();
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex) return false;
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

interface DocusealWebhookPayload {
  event_type?: string;
  timestamp?: string;
  data?: {
    id?: number;
    submission_id?: number;
    status?: string;
    audit_log_url?: string | null;
    combined_document_url?: string | null;
    submitters?: Array<{
      id: number;
      submission_id: number;
      status: string;
      documents?: Array<{ name: string; url: string }>;
    }>;
    documents?: Array<{ name: string; url: string }>;
  };
}

// Extrait l'ID submission selon que l'event porte sur la submission
// elle-même (submission.*) ou sur un submitter (form.*).
function extractSubmissionId(p: DocusealWebhookPayload): number | null {
  const d = p.data;
  if (!d) return null;
  if (p.event_type?.startsWith("submission.")) return d.id ?? null;
  if (p.event_type?.startsWith("form.")) return d.submission_id ?? d.id ?? null;
  return d.submission_id ?? d.id ?? null;
}

// Identifiant déterministe pour dédupliquer un même event reçu deux
// fois (retry DocuSeal). On combine event_type + l'id de l'objet
// concerné — chaque transition d'état n'est émise qu'une fois.
function buildEventKey(p: DocusealWebhookPayload): string | null {
  if (!p.event_type || !p.data?.id) return null;
  return `${p.event_type}:${p.data.id}`;
}

export async function POST(req: Request) {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("[webhook/docuseal] missing DOCUSEAL_WEBHOOK_SECRET env");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  // 1. Raw body avant tout parse JSON (le HMAC se calcule dessus)
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
  let payload: DocusealWebhookPayload;
  try {
    payload = JSON.parse(raw) as DocusealWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventKey = buildEventKey(payload);
  const eventType = payload.event_type;
  const submissionId = extractSubmissionId(payload);

  if (!eventKey || !eventType || !submissionId) {
    console.warn(
      "[webhook/docuseal] missing fields",
      JSON.stringify({ eventKey, eventType, submissionId })
    );
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();

  // 4. Trouver le contrat lié
  const { data: contrat, error: cErr } = await service
    .from("contrats")
    .select(
      "id, ref, statut, signed_pdf_path, proof_path, client_snapshot, montant_total, created_by, docuseal_submission_id"
    )
    .eq("docuseal_submission_id", String(submissionId))
    .maybeSingle();
  if (cErr) {
    console.error("[webhook/docuseal] contrat lookup error:", cErr);
    return NextResponse.json({ error: "lookup error" }, { status: 500 });
  }
  if (!contrat) {
    console.warn(
      "[webhook/docuseal] no contrat for submission_id",
      submissionId
    );
    return NextResponse.json({ ok: true });
  }

  // 5. Idempotence : insertion conditionnelle, si conflit → déjà traité
  const { data: insertedEvent, error: insertErr } = await service
    .from("contrat_events")
    .upsert(
      {
        contrat_id: contrat.id,
        docuseal_event_id: eventKey,
        event_name: eventType,
        payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "docuseal_event_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (insertErr) {
    console.error("[webhook/docuseal] contrat_events insert error:", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  if (!insertedEvent) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // 6. Routage par event_type
  try {
    if (eventType === "submission.completed") {
      await handleSigned(service, contrat, submissionId);
    } else if (eventType === "submission.expired") {
      await handleStatusChange(service, contrat, "expire", "contract_expired");
    } else if (
      eventType === "form.declined" ||
      eventType === "submission.declined"
    ) {
      await handleStatusChange(service, contrat, "refuse", "contract_refused");
    }
    // submission.created / form.viewed / form.started / form.completed →
    // loggés dans contrat_events uniquement (pas de transition de statut)
  } catch (err) {
    console.error("[webhook/docuseal] handler error:", err);
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
  submissionId: number
) {
  // 1. Télécharger le PDF signé combiné + le dossier de preuve.
  //    downloadSignedPdf lit la submission, suit combined_document_url.
  const signedPdf = await downloadSignedPdf(submissionId);
  let proof: Buffer | null = null;
  try {
    proof = await downloadAuditLog(submissionId);
  } catch (err) {
    console.error(
      "[webhook/docuseal] downloadAuditLog failed (continuing):",
      err
    );
  }

  // 2. Upload Storage
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
        "[webhook/docuseal] proof upload failed:",
        upProofErr.message
      );
      proofPath = null;
    }
  }

  // 3. Update contrat
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

  // 4. Notifications MailerSend (fire-and-forget)
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
      console.error("[webhook/docuseal] notif internal failed:", e)
    ),
    sendContratSignedClient(
      ctx,
      signedPdf,
      contratPdfFilename({ id: contrat.id, ref: contrat.ref }).replace(
        /\.pdf$/,
        "-signe.pdf"
      )
    ).catch((e) =>
      console.error("[webhook/docuseal] notif client failed:", e)
    ),
  ]);
}
