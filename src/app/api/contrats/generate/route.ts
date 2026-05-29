import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateContratPdf,
  contratPdfStoragePath,
} from "@/lib/contrats/generate-pdf";
import {
  freezeClientSnapshot,
  insertContratActivity,
} from "@/lib/contrats/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "contrats";

const bodySchema = z.object({
  deal_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  ref: z.string().trim().min(1).max(50),
  options: z.object({
    site: z.boolean(),
    maintenance: z.boolean(),
    seo_ads: z.boolean(),
    social: z.boolean(),
  }),
  montant_total: z.number().positive().finite(),
  client_snapshot_override: z.object({
    raison_sociale: z.string().trim().min(1).optional(),
    siret: z
      .string()
      .trim()
      .regex(/^\d{14}$/, "SIRET = 14 chiffres"),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().nullable().optional(),
    representant: z.string().trim().nullable().optional(),
    adresse: z.string().trim().nullable().optional(),
  }),
});

export async function POST(req: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
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

  // Snapshot client figé (raison sociale + SIRET + email + tél + représentant)
  const client_snapshot = await freezeClientSnapshot(service, {
    dealId: input.deal_id ?? null,
    contactId: input.contact_id ?? null,
    override: input.client_snapshot_override,
  });

  const montant_total = Number(input.montant_total.toFixed(2));
  const acompte = Number((montant_total * 0.3).toFixed(2));
  const solde = Number((montant_total - acompte).toFixed(2));

  // INSERT contrat (statut = 'genere')
  const { data: contrat, error: insertErr } = await service
    .from("contrats")
    .insert({
      deal_id: input.deal_id ?? null,
      contact_id: input.contact_id ?? null,
      ref: input.ref,
      client_snapshot,
      options: input.options,
      montant_total,
      acompte,
      solde,
      statut: "genere",
      created_by: user.id,
    })
    .select("id, ref, created_at")
    .single();

  if (insertErr || !contrat) {
    const code = insertErr?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: `La référence ${input.ref} existe déjà` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertErr?.message ?? "Insertion impossible" },
      { status: 500 }
    );
  }

  // Génération PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateContratPdf({
      id: contrat.id,
      ref: contrat.ref,
      created_at: contrat.created_at,
      client_snapshot,
      options: input.options,
      montant_total,
      acompte,
      solde,
    });
  } catch (err) {
    console.error("[contrats/generate] pdf failed:", err);
    return NextResponse.json(
      {
        error: "Échec génération PDF",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // Upload Storage
  const path = contratPdfStoragePath(contrat.id);
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    console.error("[contrats/generate] upload failed:", upErr);
    return NextResponse.json(
      { error: "Échec upload PDF", detail: upErr.message },
      { status: 500 }
    );
  }

  await service.from("contrats").update({ pdf_path: path }).eq("id", contrat.id);

  await insertContratActivity(
    service,
    contrat.id,
    "contract_generated",
    {
      ref: contrat.ref,
      deal_id: input.deal_id ?? null,
      contact_id: input.contact_id ?? null,
      montant_total,
    },
    user.id
  );

  return NextResponse.json({ contrat_id: contrat.id, ref: contrat.ref });
}
