import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { contratPdfFilename } from "@/lib/contrats/generate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "contrats";

export async function GET(
  _req: Request,
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

  const service = createServiceClient();
  const { data: contrat, error } = await service
    .from("contrats")
    .select("id, ref, proof_path")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!contrat || !contrat.proof_path) {
    return NextResponse.json(
      { error: "Dossier de preuve introuvable" },
      { status: 404 }
    );
  }

  const { data: stored, error: dlErr } = await service.storage
    .from(BUCKET)
    .download(contrat.proof_path);
  if (dlErr || !stored) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Dossier de preuve illisible" },
      { status: 500 }
    );
  }

  const buf = Buffer.from(await stored.arrayBuffer());
  const base = contratPdfFilename({ id: contrat.id, ref: contrat.ref });
  const filename = base.replace(/\.pdf$/, "-preuve.pdf");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
