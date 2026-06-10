"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchEntityType =
  | "contact"
  | "company"
  | "deal"
  | "lead"
  | "project"
  | "invoice";

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [contacts, companies, deals, leads, projects, invoices] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`
        )
        .limit(5),
      supabase
        .from("companies")
        .select("id, name, domain")
        .ilike("name", like)
        .limit(5),
      supabase
        .from("deals")
        .select("id, title, stage, value")
        .ilike("title", like)
        .limit(5),
      // Leads "actifs" uniquement (pas dismissed/converted/duplicate) :
      // un lead converti devient un deal → on retrouve déjà la fiche via
      // la recherche deals.
      supabase
        .from("lead_imports")
        .select(
          "id, first_name, last_name, company_name, email, phone, pipeline_stage, status"
        )
        .in("status", ["pending", "qualified"])
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`
        )
        .limit(5),
      supabase
        .from("projects")
        .select("id, name, status")
        .ilike("name", like)
        .limit(5),
      supabase
        .from("invoices")
        .select("id, number, type, total, status")
        .ilike("number", like)
        .limit(5),
    ]);

  const results: SearchResult[] = [];

  for (const c of contacts.data ?? []) {
    results.push({
      type: "contact",
      id: c.id,
      label: `${c.first_name} ${c.last_name}`,
      sublabel: c.email ?? null,
      href: `/dashboard/contacts/${c.id}`,
    });
  }
  for (const c of companies.data ?? []) {
    results.push({
      type: "company",
      id: c.id,
      label: c.name,
      sublabel: c.domain ?? null,
      href: `/dashboard/companies/${c.id}`,
    });
  }
  for (const d of deals.data ?? []) {
    const value =
      d.value != null
        ? new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(Number(d.value))
        : null;
    const stageLabel: Record<string, string> = {
      discussion: "Discussion",
      proposal: "Devis",
      negotiation: "Négo.",
      won: "Gagné",
      lost: "Perdu",
    };
    results.push({
      type: "deal",
      id: d.id,
      label: d.title,
      sublabel: [stageLabel[d.stage] ?? d.stage, value]
        .filter(Boolean)
        .join(" · "),
      // ?open=deal:<id> ouvre le drawer dans PipelineClient (cf. useEffect
      // qui lit ce param au mount et déclenche openEdit).
      href: `/dashboard/pipeline?open=deal:${d.id}`,
    });
  }
  for (const l of leads.data ?? []) {
    const name =
      [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
      l.company_name ||
      l.email ||
      "(sans nom)";
    const stageLeadLabel: Record<string, string> = {
      brut: "Brut",
      verified: "Vérifié",
      to_email: "À emailer",
      to_contact: "À contacter",
      email_sent: "Email envoyé",
      contacted: "Contacté",
      in_discussion: "En discussion",
      stand_by: "Stand-by",
    };
    results.push({
      type: "lead",
      id: l.id,
      label: name,
      sublabel: [
        stageLeadLabel[l.pipeline_stage] ?? l.pipeline_stage,
        l.company_name && name !== l.company_name ? l.company_name : null,
      ]
        .filter(Boolean)
        .join(" · "),
      // ?open=lead:<id> ouvre le LeadDrawer dans PipelineClient.
      href: `/dashboard/pipeline?open=lead:${l.id}`,
    });
  }
  for (const p of projects.data ?? []) {
    const statusLabel: Record<string, string> = {
      en_attente: "En attente",
      en_cours: "En cours",
      en_pause: "En pause",
      termine: "Terminé",
      annule: "Annulé",
    };
    results.push({
      type: "project",
      id: p.id,
      label: p.name,
      sublabel: statusLabel[p.status] ?? p.status,
      href: `/dashboard/projets/${p.id}`,
    });
  }
  for (const i of invoices.data ?? []) {
    const total = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(i.total ?? 0));
    results.push({
      type: "invoice",
      id: i.id,
      label: i.number,
      sublabel: `${i.type === "quote" ? "Devis" : "Facture"} · ${total}`,
      href: `/dashboard/facturation/${i.id}`,
    });
  }

  return results;
}
