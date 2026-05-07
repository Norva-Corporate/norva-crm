"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Mention } from "@/types";

export interface MentionGroup {
  type: Mention["type"];
  label: string;
  items: Mention[];
}

const GROUPS: Array<{ type: Mention["type"]; label: string }> = [
  { type: "user", label: "Membres" },
  { type: "company", label: "Entreprises" },
  { type: "contact", label: "Contacts" },
  { type: "project", label: "Projets" },
  { type: "task", label: "Tâches" },
  { type: "invoice", label: "Factures" },
];

export function useMentionSearch(query: string) {
  const [results, setResults] = useState<MentionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const like = `%${trimmed}%`;
      const limit = 5;

      const queries = [
        trimmed
          ? supabase
              .from("profiles")
              .select("id, full_name, email")
              .ilike("full_name", like)
              .limit(limit)
          : supabase
              .from("profiles")
              .select("id, full_name, email")
              .order("full_name", { ascending: true })
              .limit(limit),
        trimmed
          ? supabase
              .from("companies")
              .select("id, name")
              .ilike("name", like)
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
        trimmed
          ? supabase
              .from("contacts")
              .select("id, first_name, last_name")
              .or(`first_name.ilike.${like},last_name.ilike.${like}`)
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
        trimmed
          ? supabase
              .from("projects")
              .select("id, name")
              .ilike("name", like)
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
        trimmed
          ? supabase
              .from("tasks")
              .select("id, title")
              .ilike("title", like)
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
        trimmed
          ? supabase
              .from("invoices")
              .select("id, number")
              .ilike("number", like)
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
      ] as const;

      const [users, companies, contacts, projects, tasks, invoices] =
        await Promise.all(queries);

      if (cancelled) return;

      const groups: MentionGroup[] = GROUPS.map((g) => {
        switch (g.type) {
          case "user":
            return {
              ...g,
              items: ((users.data ?? []) as Array<{
                id: string;
                full_name: string | null;
                email: string;
              }>).map<Mention>((u) => ({
                type: "user",
                id: u.id,
                label: u.full_name?.trim() || u.email,
              })),
            };
          case "company":
            return {
              ...g,
              items: ((companies.data ?? []) as Array<{
                id: string;
                name: string;
              }>).map<Mention>((c) => ({
                type: "company",
                id: c.id,
                label: c.name,
              })),
            };
          case "contact":
            return {
              ...g,
              items: ((contacts.data ?? []) as Array<{
                id: string;
                first_name: string;
                last_name: string;
              }>).map<Mention>((c) => ({
                type: "contact",
                id: c.id,
                label: `${c.first_name} ${c.last_name}`.trim(),
              })),
            };
          case "project":
            return {
              ...g,
              items: ((projects.data ?? []) as Array<{
                id: string;
                name: string;
              }>).map<Mention>((p) => ({
                type: "project",
                id: p.id,
                label: p.name,
              })),
            };
          case "task":
            return {
              ...g,
              items: ((tasks.data ?? []) as Array<{
                id: string;
                title: string;
              }>).map<Mention>((t) => ({
                type: "task",
                id: t.id,
                label: t.title,
              })),
            };
          case "invoice":
            return {
              ...g,
              items: ((invoices.data ?? []) as Array<{
                id: string;
                number: string;
              }>).map<Mention>((i) => ({
                type: "invoice",
                id: i.id,
                label: i.number,
              })),
            };
        }
      }).filter((g) => g.items.length > 0);

      setResults(groups);
      setLoading(false);
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return { results, loading };
}
