import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateBriefPdf,
  briefPdfFilename,
  briefPdfStoragePath,
  type BriefForPdf,
} from "@/lib/briefs/generate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "briefs-pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("regenerate") === "1";

  const service = createServiceClient();

  // Fetch brief
  const { data: brief, error: briefErr } = await service
    .from("briefs")
    .select(
      "id, prospect_nom, prospect_email, prospect_entreprise, submitted_at, reponses, pdf_path, archived_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (briefErr) {
    return NextResponse.json({ error: briefErr.message }, { status: 500 });
  }
  if (!brief || brief.archived_at) {
    return NextResponse.json({ error: "Brief introuvable" }, { status: 404 });
  }

  const path = brief.pdf_path ?? briefPdfStoragePath(brief.id);
  const filename = briefPdfFilename({
    id: brief.id,
    prospect_nom: brief.prospect_nom,
    prospect_email: brief.prospect_email,
    prospect_entreprise: brief.prospect_entreprise,
    submitted_at: brief.submitted_at,
    reponses: (brief.reponses ?? {}) as Record<string, unknown>,
  });

  // Sert depuis Storage si un PDF existe déjà et qu'on ne force pas
  if (!force && brief.pdf_path) {
    const { data: stored, error: dlErr } = await service.storage
      .from(BUCKET)
      .download(brief.pdf_path);
    if (!dlErr && stored) {
      const buf = Buffer.from(await stored.arrayBuffer());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    // Si l'objet a disparu du bucket, on continue et on régénère.
    console.warn(
      `[briefs/pdf] stored object missing for ${brief.id}: ${dlErr?.message}`
    );
  }

  // Génération
  const briefForPdf: BriefForPdf = {
    id: brief.id,
    prospect_nom: brief.prospect_nom,
    prospect_email: brief.prospect_email,
    prospect_entreprise: brief.prospect_entreprise,
    submitted_at: brief.submitted_at,
    reponses: (brief.reponses ?? {}) as Record<string, unknown>,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateBriefPdf(briefForPdf);
  } catch (err) {
    console.error("[briefs/pdf] generation failed:", err);
    return NextResponse.json(
      { error: "Échec de génération PDF" },
      { status: 500 }
    );
  }

  // Upload (best effort — on streame le PDF de toute façon)
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (!upErr) {
    await service
      .from("briefs")
      .update({
        pdf_path: path,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", brief.id);
  } else {
    console.error("[briefs/pdf] upload failed:", upErr);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
