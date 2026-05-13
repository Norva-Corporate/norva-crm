import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Building2,
  Calendar,
  Download,
  User,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArchiveBriefButton } from "@/components/briefs/archive-brief-button";
import { CreateProjectFromBriefButton } from "@/components/briefs/create-project-from-brief-button";
import { getBriefById } from "@/lib/actions/briefs";
import {
  groupReponsesBySections,
  labelForOption,
  KPI_LABELS,
} from "@/lib/briefs/sections";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return (
    typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasFields(v: unknown, keys: readonly string[]): boolean {
  if (!isRecord(v)) return false;
  return keys.some((k) => typeof v[k] === "string");
}

const URL_ENTRY_KEYS = ["url", "note"] as const;
const CONTACT_ENTRY_KEYS = ["nom", "role_entreprise", "role_projet", "email"] as const;

function renderValue(value: unknown, fieldKey?: string): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">(vide)</span>;
  }
  if (isPrimitive(value)) {
    return (
      <span className="text-foreground whitespace-pre-wrap break-words">
        {String(value)}
      </span>
    );
  }

  // Array of strings → checkbox list (use OPTION_LABELS si dispo)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">(vide)</span>;
    }
    if (value.every((v) => typeof v === "string")) {
      const items = value as string[];
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.map((v, i) => (
            <span
              key={i}
              className="inline-block text-xs px-2 py-0.5 bg-accent/10 text-accent"
            >
              {fieldKey ? labelForOption(fieldKey, v) : v}
            </span>
          ))}
        </div>
      );
    }

    // Array d'objets URL {url, note}
    if (value.every((v) => hasFields(v, URL_ENTRY_KEYS))) {
      const entries = value as { url?: string; note?: string }[];
      const filled = entries.filter((e) => e.url?.trim() || e.note?.trim());
      if (filled.length === 0) {
        return <span className="text-muted-foreground italic">(vide)</span>;
      }
      return (
        <ul className="space-y-1.5">
          {filled.map((e, i) => (
            <li
              key={i}
              className="grid grid-cols-[20px_1fr] gap-2 text-sm"
            >
              <span className="font-mono text-[10px] text-accent mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                {e.url && (
                  <a
                    href={e.url.startsWith("http") ? e.url : `https://${e.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-accent transition-colors break-all"
                  >
                    {e.url}
                  </a>
                )}
                {e.note && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    // Array d'objets Contact {nom, role_entreprise, role_projet, email}
    if (value.every((v) => hasFields(v, CONTACT_ENTRY_KEYS))) {
      const entries = value as {
        nom?: string;
        role_entreprise?: string;
        role_projet?: string;
        email?: string;
      }[];
      const filled = entries.filter(
        (e) => e.nom?.trim() || e.email?.trim() || e.role_entreprise?.trim()
      );
      if (filled.length === 0) {
        return <span className="text-muted-foreground italic">(vide)</span>;
      }
      return (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-1 py-1">Nom</th>
                <th className="text-left font-medium px-1 py-1">Rôle entreprise</th>
                <th className="text-left font-medium px-1 py-1">Rôle projet</th>
                <th className="text-left font-medium px-1 py-1">Email</th>
              </tr>
            </thead>
            <tbody>
              {filled.map((e, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-1 py-1.5 text-foreground">{e.nom ?? "—"}</td>
                  <td className="px-1 py-1.5 text-foreground">
                    {e.role_entreprise ?? "—"}
                  </td>
                  <td className="px-1 py-1.5 text-foreground">
                    {e.role_projet ?? "—"}
                  </td>
                  <td className="px-1 py-1.5 text-foreground">
                    {e.email ? (
                      <a
                        href={`mailto:${e.email}`}
                        className="text-accent hover:underline"
                      >
                        {e.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Objet kpi-style (key/value pairs)
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== "" && v != null);
    if (entries.length === 0) {
      return <span className="text-muted-foreground italic">(vide)</span>;
    }
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-xs text-muted-foreground shrink-0">
              {KPI_LABELS[k] ?? humanizeKey(k)} :
            </dt>
            <dd className="text-sm text-foreground">{String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  // Fallback : JSON brut
  return (
    <pre className="text-xs font-mono bg-[var(--surface)] border border-[var(--border)] p-3 overflow-x-auto whitespace-pre-wrap break-words text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await getBriefById(id);
  if (!brief) notFound();

  const entries = Object.entries(brief.reponses ?? {});
  const grouped = groupReponsesBySections(brief.reponses);
  const hasGroupedContent =
    grouped.sections.length > 0 || grouped.orphans.length > 0;

  const contactName = brief.contact
    ? [brief.contact.first_name, brief.contact.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || brief.contact.email
    : null;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Détail brief" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {/* Back link */}
        <div>
          <Link
            href="/dashboard/briefs"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux briefs
          </Link>
        </div>

        {/* Prospect header */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2 min-w-0">
                <h1 className="text-lg font-semibold text-foreground truncate">
                  {brief.prospect_nom ?? "Prospect"}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {brief.prospect_email && (
                    <a
                      href={`mailto:${brief.prospect_email}`}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      {brief.prospect_email}
                    </a>
                  )}
                  {brief.prospect_entreprise && !brief.company && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {brief.prospect_entreprise}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Soumis le {formatDateTime(brief.submitted_at)}
                  </span>
                </div>

                {/* Liens CRM */}
                {(brief.contact || brief.company) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {brief.contact && (
                      <Link
                        href={`/dashboard/contacts/${brief.contact.id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        <User className="h-3 w-3" />
                        {contactName ?? "Contact"}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    )}
                    {brief.company && (
                      <Link
                        href={`/dashboard/companies/${brief.company.id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        <Building2 className="h-3 w-3" />
                        {brief.company.name}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/briefs/${brief.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger PDF
                  </a>
                </Button>
                <CreateProjectFromBriefButton
                  briefId={brief.id}
                  briefName={brief.prospect_nom ?? "ce brief"}
                  hasContact={brief.contact !== null}
                  hasCompany={brief.company !== null}
                />
                <ArchiveBriefButton
                  briefId={brief.id}
                  briefName={brief.prospect_nom ?? "ce brief"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Réponses — groupées par section */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Réponses ({entries.length} champ{entries.length > 1 ? "s" : ""})
          </h2>

          {!hasGroupedContent ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune réponse enregistrée.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {grouped.sections.map((s) => (
                <Card key={s.section.id}>
                  <CardContent className="p-0">
                    <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
                      <p className="text-[10px] font-mono uppercase tracking-[0.10em] text-accent mb-1">
                        {s.section.label.split(".")[0]}
                      </p>
                      <h3 className="text-sm font-semibold text-foreground">
                        {s.section.label.split(". ").slice(1).join(". ")}
                      </h3>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {s.fields.map((f) => (
                        <div
                          key={f.key}
                          className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6"
                        >
                          <div className="text-xs font-medium text-muted-foreground md:pt-0.5">
                            {f.label}
                          </div>
                          <div className="text-sm">
                            {renderValue(f.value, f.key)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {grouped.orphans.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
                      <p className="text-[10px] font-mono uppercase tracking-[0.10em] text-muted-foreground mb-1">
                        Autres
                      </p>
                      <h3 className="text-sm font-semibold text-foreground">
                        Champs additionnels
                      </h3>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {grouped.orphans.map((f) => (
                        <div
                          key={f.key}
                          className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6"
                        >
                          <div className="text-xs font-medium text-muted-foreground md:pt-0.5">
                            {humanizeKey(f.key)}
                          </div>
                          <div className="text-sm">
                            {renderValue(f.value, f.key)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
