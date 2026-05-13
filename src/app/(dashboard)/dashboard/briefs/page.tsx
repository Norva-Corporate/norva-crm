import React from "react";
import Link from "next/link";
import { FileText, Mail, Building2, Calendar } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateTokenDialog } from "@/components/briefs/generate-token-dialog";
import { listBriefs, listActiveTokens } from "@/lib/actions/briefs";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function tokenStatus(token: {
  used: boolean;
  expires_at: string;
}): { label: string; tone: "ok" | "warn" | "muted" } {
  if (token.used) return { label: "Utilisé", tone: "muted" };
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return { label: "Expiré", tone: "warn" };
  }
  return { label: "Actif", tone: "ok" };
}

const toneClasses: Record<string, string> = {
  ok: "bg-success/10 text-[#4ADE80]",
  warn: "bg-warning/10 text-[#FCD34D]",
  muted: "bg-[var(--muted)] text-muted-foreground",
};

export default async function BriefsPage() {
  const [briefs, tokens] = await Promise.all([
    listBriefs(),
    listActiveTokens(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Briefs" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {/* Header section avec CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {briefs.length} brief{briefs.length > 1 ? "s" : ""} reçu
              {briefs.length > 1 ? "s" : ""} · {tokens.length} lien
              {tokens.length > 1 ? "s" : ""} récent
              {tokens.length > 1 ? "s" : ""}
            </p>
          </div>
          <GenerateTokenDialog />
        </div>

        {/* Briefs reçus */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Briefs reçus
          </h2>

          {briefs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground">Aucun brief pour l&apos;instant</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Génère un lien et envoie-le à un prospect pour démarrer.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: cartes */}
              <div className="space-y-2 md:hidden">
                {briefs.map((b) => (
                  <Link
                    key={b.id}
                    href={`/dashboard/briefs/${b.id}`}
                    className="block"
                  >
                    <Card className="hover:bg-[var(--muted)]/30 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {b.prospect_nom ?? "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground shrink-0">
                            {formatDate(b.submitted_at)}
                          </p>
                        </div>
                        {b.prospect_entreprise && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" />
                            {b.prospect_entreprise}
                          </p>
                        )}
                        {b.prospect_email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.prospect_email}</span>
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Desktop: table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left px-5 py-3 font-medium text-xs text-muted-foreground">
                            Prospect
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Entreprise
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Email
                          </th>
                          <th className="text-right px-5 py-3 font-medium text-xs text-muted-foreground">
                            Soumis le
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {briefs.map((b) => (
                          <tr
                            key={b.id}
                            className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/30 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <Link
                                href={`/dashboard/briefs/${b.id}`}
                                className="text-foreground hover:text-accent transition-colors"
                              >
                                {b.prospect_nom ?? "—"}
                              </Link>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {b.prospect_entreprise ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {b.prospect_email ?? "—"}
                            </td>
                            <td className="px-5 py-3 text-right text-muted-foreground font-mono text-xs">
                              {formatDate(b.submitted_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* Tokens récents */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Liens récents
          </h2>

          {tokens.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Aucun lien généré pour l&apos;instant.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: cartes */}
              <div className="space-y-2 md:hidden">
                {tokens.map((t) => {
                  const status = tokenStatus(t);
                  return (
                    <Card key={t.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t.prospect_nom}
                          </p>
                          <span
                            className={`text-[10px] px-2 py-0.5 ${toneClasses[status.tone]}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.prospect_email}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {t.used && t.used_at
                            ? `Utilisé le ${formatDateTime(t.used_at)}`
                            : `Expire le ${formatDateTime(t.expires_at)}`}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left px-5 py-3 font-medium text-xs text-muted-foreground">
                            Prospect
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Entreprise
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Créé le
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Expire le
                          </th>
                          <th className="text-right px-5 py-3 font-medium text-xs text-muted-foreground">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokens.map((t) => {
                          const status = tokenStatus(t);
                          return (
                            <tr
                              key={t.id}
                              className="border-b border-[var(--border)] last:border-b-0"
                            >
                              <td className="px-5 py-3 text-foreground">
                                {t.prospect_nom}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {t.prospect_entreprise ?? "—"}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground font-mono text-xs">
                                {formatDateTime(t.created_at)}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground font-mono text-xs">
                                {formatDateTime(t.expires_at)}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span
                                  className={`inline-block text-[10px] px-2 py-0.5 ${toneClasses[status.tone]}`}
                                >
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
