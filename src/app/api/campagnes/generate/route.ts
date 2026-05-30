import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchGoogleMapsInfo(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    // Extract rating, review count, category from page meta/content
    const ratingMatch = html.match(/(\d[,\.]\d)\s*(?:étoile|star)/i);
    const reviewsMatch = html.match(/(\d[\d\s]*)\s*(?:avis|review)/i);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

    const parts: string[] = [];
    if (titleMatch) parts.push(`Nom: ${titleMatch[1].replace(" - Google Maps", "").trim()}`);
    if (ratingMatch) parts.push(`Note: ${ratingMatch[1]}/5`);
    if (reviewsMatch) parts.push(`Avis: ${reviewsMatch[1].trim()}`);

    return parts.length > 0 ? parts.join(" | ") : "Présence Google Maps trouvée";
  } catch {
    return "Impossible de récupérer les infos Google Maps";
  }
}

export async function POST(req: NextRequest) {
  // Verify internal secret to protect the endpoint
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch settings
  const { data: settingsRows } = await supabase
    .from("prospection_settings")
    .select("key, value");
  const settings: Record<string, string> = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  );
  const maxPerDay = parseInt(settings.max_per_day ?? "10", 10);

  // Get leads to_email that don't already have a pending campaign today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingToday } = await supabase
    .from("email_campaigns")
    .select("lead_id")
    .gte("created_at", todayStart.toISOString());

  const alreadyDoneIds = (existingToday ?? []).map((c) => c.lead_id);

  let query = supabase
    .from("lead_imports")
    .select("*")
    .eq("pipeline_stage", "to_email")
    .not("email", "is", null)
    .limit(maxPerDay);

  if (alreadyDoneIds.length > 0) {
    query = query.not("id", "in", `(${alreadyDoneIds.join(",")})`);
  }

  const { data: leads } = await query;

  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: "Aucun lead à traiter", generated: 0 });
  }

  let generated = 0;

  for (const lead of leads) {
    const raw = lead.raw_payload as Record<string, unknown> | null;
    const googleMapsUrl = raw?.google_maps_url as string | undefined;

    let googleInfo = "";
    if (googleMapsUrl) {
      googleInfo = await fetchGoogleMapsInfo(googleMapsUrl);
    }

    const companyName = lead.company_name ?? "l'entreprise";
    const firstName = lead.first_name ?? "";
    const lastName = lead.last_name ?? "";
    const role = lead.role ?? "";

    const prompt = `Tu es un expert en prospection commerciale pour une agence web. Tu dois rédiger 3 emails de cold email distincts pour proposer la création d'un site internet et/ou une amélioration de la présence en ligne.

Infos sur le prospect :
- Entreprise : ${companyName}
- Contact : ${firstName} ${lastName}${role ? ` (${role})` : ""}
- Présence Google : ${googleInfo || "Pas d'infos Google Maps disponibles"}

Contexte : Ce prospect n'a probablement pas de site internet (c'est ce qu'on veut lui vendre) ou un site obsolète. On a trouvé sa présence sur Google Maps.

Génère exactement 3 variants d'email. Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "variant_1": {
    "tone": "Direct et professionnel",
    "subject": "...",
    "body": "..."
  },
  "variant_2": {
    "tone": "Storytelling / empathique",
    "subject": "...",
    "body": "..."
  },
  "variant_3": {
    "tone": "Question ouverte / curiosité",
    "subject": "...",
    "body": "..."
  }
}

Règles :
- Emails courts (5-8 lignes max)
- Personnalisés avec les infos disponibles (note Google, manque de site, etc.)
- Naturels, pas robotiques
- Signature : Norva Groupe | norvagroupe@gmail.com
- Ne mentionne PAS que tu es une IA
- Tutoiement ou vouvoiement selon le ton`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const variants = JSON.parse(jsonMatch[0]);

      await supabase.from("email_campaigns").insert({
        lead_id: lead.id,
        lead_snapshot: {
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          company_name: lead.company_name,
          role: lead.role,
          google_info: googleInfo,
          google_maps_url: googleMapsUrl,
        },
        variant_1: variants.variant_1,
        variant_2: variants.variant_2,
        variant_3: variants.variant_3,
        status: "pending",
      });

      generated++;
    } catch {
      // Skip this lead on error, continue with others
      continue;
    }
  }

  return NextResponse.json({ message: "Génération terminée", generated });
}
