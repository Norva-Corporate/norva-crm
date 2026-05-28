"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchEntityType =
  | "contact"
  | "company"
  | "deal"
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

  const [contacts, companies, deals, projects, invoices] = await Promise.all([
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
      href: `/dashboard/pipeline`,
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
