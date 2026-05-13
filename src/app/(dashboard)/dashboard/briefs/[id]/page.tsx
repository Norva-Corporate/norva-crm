import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Building2,
  Calendar,
  Download,
  FolderPlus,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBriefById } from "@/lib/actions/briefs";

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

function renderValue(value: unknown): React.ReactNode {
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
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">(vide)</span>;
    }
    if (value.every(isPrimitive)) {
      return (
        <ul className="list-disc list-inside text-foreground space-y-0.5">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
  }
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
              <div className="space-y-1.5 min-w-0">
                <h1 className="text-lg font-semibold text-foreground truncate">
                  {brief.prospect_nom ?? "Prospect"}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {brief.prospect_entreprise && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {brief.prospect_entreprise}
                    </span>
                  )}
                  {brief.prospect_email && (
                    <a
                      href={`mailto:${brief.prospect_email}`}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      {brief.prospect_email}
                    </a>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Soumis le {formatDateTime(brief.submitted_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button variant="outline" size="sm" disabled title="Disponible en Phase 2">
                  <Download className="h-3.5 w-3.5" />
                  Télécharger PDF
                </Button>
                <Button variant="outline" size="sm" disabled title="Disponible en Phase 2">
                  <FolderPlus className="h-3.5 w-3.5" />
                  Créer un projet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Réponses */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Réponses ({entries.length} champ{entries.length > 1 ? "s" : ""})
          </h2>

          {entries.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune réponse enregistrée.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-[var(--border)]">
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6"
                  >
                    <div className="text-xs font-medium text-muted-foreground md:pt-0.5">
                      {humanizeKey(key)}
                    </div>
                    <div className="text-sm">{renderValue(value)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
