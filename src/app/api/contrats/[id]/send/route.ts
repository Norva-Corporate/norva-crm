import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  contratPdfStoragePath,
  contratPdfFilename,
} from "@/lib/contrats/generate-pdf";
import { insertContratActivity } from "@/lib/contrats/server";
import {
  createSubmission,
  createTemplateFromPdf,
  DocusealError,
} from "@/lib/docuseal";
import {
  CONTRAT_SIGNATURE_AREA,
  CONTRAT_SIGNATURE_PAGE_INDEX,
  type ContratClientSnapshot,
} from "@/lib/contrats/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "contrats";

const bodySchema = z.object({
  // Permet d'override le signataire avant envoi (sinon repris du snapshot)
  signer: z
    .object({
      first_name: z.string().trim().min(1),
      last_name: z.string().trim().min(1),
      email: z.string().trim().email(),
      phone_number: z.string().trim().optional(),
    })
    .optional(),
  expires_in_days: z.number().int().min(1).max(90).default(30),
});

function deriveSigner(
  client: ContratClientSnapshot
): { first_name: string; last_name: string; email: string; phone_number?: string } | null {
  if (!client.email) return null;
  const fullName = client.representant ?? client.raison_sociale ?? "";
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts[0] ?? "Client";
  const last_name = parts.slice(1).join(" ") || client.raison_sociale || "—";
  return {
    first_name,
    last_name,
    email: client.email,
    phone_number: client.phone ?? undefined,
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // body optionnel
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const service = createServiceClient();

  const { data: contrat, error } = await service
    .from("contrats")
    .select(
      "id, ref, statut, client_snapshot, pdf_path, docuseal_submission_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!contrat) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (contrat.statut !== "genere") {
    return NextResponse.json(
      { error: `Statut invalide pour envoi : ${contrat.statut}` },
      { status: 409 }
    );
  }
  if (!contrat.pdf_path) {
    return NextResponse.json(
      { error: "PDF non disponible — régénérer le contrat" },
      { status: 409 }
    );
  }

  const client = contrat.client_snapshot as ContratClientSnapshot;
  const signer = input.signer ?? deriveSigner(client);
  if (!signer) {
    return NextResponse.json(
      { error: "Email signataire manquant" },
      { status: 400 }
    );
  }

  // Download PDF
  const { data: stored, error: dlErr } = await service.storage
    .from(BUCKET)
    .download(contrat.pdf_path);
  if (dlErr || !stored) {
    return NextResponse.json(
      { error: "Impossible de lire le PDF généré", detail: dlErr?.message },
      { status: 500 }
    );
  }
  const pdfBuffer = Buffer.from(await stored.arrayBuffer());

  try {
    // 1. Upload du PDF comme template DocuSeal (avec champ signature
    //    placé sur la dernière page, colonne droite).
    const filename = contratPdfFilename({ id: contrat.id, ref: contrat.ref });
    const template = await createTemplateFromPdf({
      name: `Contrat ${contrat.ref} — ${client.raison_sociale}`,
      pdfBuffer,
      filename,
      fields: [
        {
          name: "Signature",
          type: "signature",
          required: true,
          areas: [
            {
              page: CONTRAT_SIGNATURE_PAGE_INDEX,
              x: CONTRAT_SIGNATURE_AREA.x,
              y: CONTRAT_SIGNATURE_AREA.y,
              w: CONTRAT_SIGNATURE_AREA.w,
              h: CONTRAT_SIGNATURE_AREA.h,
            },
          ],
        },
      ],
    });

    // 2. Création de la submission → DocuSeal envoie l'email au signataire
    const fullName = `${signer.first_name} ${signer.last_name}`.trim();
    const submitter = await createSubmission({
      templateId: template.id,
      signer: {
        email: signer.email,
        name: fullName || undefined,
        phone: signer.phone_number,
        role: "Client",
      },
      sendEmail: true,
    });

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + input.expires_in_days * 24 * 60 * 60 * 1000
    );

    await service
      .from("contrats")
      .update({
        statut: "envoye",
        docuseal_submission_id: String(submitter.submission_id),
        docuseal_submitter_id: String(submitter.id),
        sent_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", contrat.id);

    await insertContratActivity(
      service,
      contrat.id,
      "contract_sent",
      {
        ref: contrat.ref,
        signer_email: signer.email,
        docuseal_submission_id: submitter.submission_id,
        docuseal_submitter_id: submitter.id,
        expires_at: expiresAt.toISOString(),
      },
      user.id
    );

    return NextResponse.json({ statut: "envoye" });
  } catch (err) {
    if (err instanceof DocusealError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    console.error("[contrats/send] error:", err);
    return NextResponse.json(
      {
        error: "Erreur DocuSeal",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
