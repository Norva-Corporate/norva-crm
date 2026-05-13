"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Mail,
  Building2,
  Calendar,
  MoreHorizontal,
  Archive,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArchiveConfirmModal } from "@/components/briefs/archive-confirm-modal";
import {
  archiveBriefToken,
  archiveBrief,
  type BriefListItem,
  type BriefTokenItem,
  type BriefContactRef,
  type BriefCompanyRef,
} from "@/lib/actions/briefs";

interface BriefsClientProps {
  briefs: BriefListItem[];
  tokens: BriefTokenItem[];
  /** Base URL utilisée pour reconstituer le lien d'un token (Copy link) */
  vitrineBaseUrl: string;
}

type ArchiveTarget =
  | { kind: "token"; id: string; name: string }
  | { kind: "brief"; id: string; name: string };

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

function tokenStatus(token: BriefTokenItem): {
  label: string;
  tone: "ok" | "warn" | "muted";
} {
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

function contactName(c: BriefContactRef | null): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

function ContactLink({ contact }: { contact: BriefContactRef | null }) {
  if (!contact) return <span className="text-muted-foreground">—</span>;
  return (
    <Link
      href={`/dashboard/contacts/${contact.id}`}
      className="text-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
    >
      {contactName(contact) || contact.email || "(sans nom)"}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </Link>
  );
}

function CompanyLink({ company }: { company: BriefCompanyRef | null }) {
  if (!company) return <span className="text-muted-foreground">—</span>;
  return (
    <Link
      href={`/dashboard/companies/${company.id}`}
      className="text-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
    >
      {company.name}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </Link>
  );
}

export function BriefsClient({
  briefs,
  tokens,
  vitrineBaseUrl,
}: BriefsClientProps) {
  const router = useRouter();
  const [archiving, setArchiving] = useState<ArchiveTarget | null>(null);

  const copyTokenLink = async (token: string) => {
    const url = `${vitrineBaseUrl.replace(/\/$/, "")}/brief?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const handleConfirmArchive = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!archiving) return { success: false, error: "Cible introuvable" };
    const res =
      archiving.kind === "token"
        ? await archiveBriefToken(archiving.id)
        : await archiveBrief(archiving.id);
    if (res.success) {
      toast.success(
        archiving.kind === "token" ? "Lien archivé" : "Brief archivé"
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
    return res;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Briefs reçus */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Briefs reçus
          </h2>

          {briefs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground">
                  Aucun brief pour l&apos;instant
                </p>
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
                  <Card key={b.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/dashboard/briefs/${b.id}`}
                          className="flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-foreground truncate hover:text-accent transition-colors">
                            {b.prospect_nom ?? "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDate(b.submitted_at)}
                          </p>
                        </Link>
                        <BriefRowMenu
                          onArchive={() =>
                            setArchiving({
                              kind: "brief",
                              id: b.id,
                              name: b.prospect_nom ?? "ce brief",
                            })
                          }
                          briefId={b.id}
                        />
                      </div>
                      {b.company ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          <CompanyLink company={b.company} />
                        </p>
                      ) : (
                        b.prospect_entreprise && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" />
                            {b.prospect_entreprise}
                          </p>
                        )
                      )}
                      {b.contact ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            <ContactLink contact={b.contact} />
                          </span>
                        </p>
                      ) : (
                        b.prospect_email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.prospect_email}</span>
                          </p>
                        )
                      )}
                    </CardContent>
                  </Card>
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
                            Contact CRM
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Entreprise CRM
                          </th>
                          <th className="text-right px-3 py-3 font-medium text-xs text-muted-foreground">
                            Soumis le
                          </th>
                          <th className="w-12 px-3 py-3" aria-label="Actions" />
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
                              {!b.contact && b.prospect_email && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {b.prospect_email}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              <ContactLink contact={b.contact} />
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {b.company ? (
                                <CompanyLink company={b.company} />
                              ) : (
                                <span className="text-muted-foreground">
                                  {b.prospect_entreprise ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right text-muted-foreground font-mono text-xs">
                              {formatDate(b.submitted_at)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <BriefRowMenu
                                onArchive={() =>
                                  setArchiving({
                                    kind: "brief",
                                    id: b.id,
                                    name: b.prospect_nom ?? "ce brief",
                                  })
                                }
                                briefId={b.id}
                              />
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
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {t.prospect_nom}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 ${toneClasses[status.tone]}`}
                          >
                            {status.label}
                          </span>
                          <TokenRowMenu
                            isUsed={t.used}
                            onCopy={() => copyTokenLink(t.token)}
                            onArchive={() =>
                              setArchiving({
                                kind: "token",
                                id: t.id,
                                name: t.prospect_nom,
                              })
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.prospect_email}
                        </p>
                        {(t.contact || t.company) && (
                          <p className="text-[11px] text-muted-foreground">
                            {t.contact && (
                              <span className="inline-block mr-3">
                                <ContactLink contact={t.contact} />
                              </span>
                            )}
                            {t.company && <CompanyLink company={t.company} />}
                          </p>
                        )}
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
                            Contact / Entreprise CRM
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Créé le
                          </th>
                          <th className="text-left px-3 py-3 font-medium text-xs text-muted-foreground">
                            Expire le
                          </th>
                          <th className="text-right px-3 py-3 font-medium text-xs text-muted-foreground">
                            Statut
                          </th>
                          <th className="w-12 px-3 py-3" aria-label="Actions" />
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
                              <td className="px-5 py-3">
                                <p className="text-foreground">
                                  {t.prospect_nom}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {t.prospect_email}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-sm">
                                {t.contact && (
                                  <div>
                                    <ContactLink contact={t.contact} />
                                  </div>
                                )}
                                {t.company && (
                                  <div className="text-[11px] mt-0.5">
                                    <CompanyLink company={t.company} />
                                  </div>
                                )}
                                {!t.contact && !t.company && (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground font-mono text-xs">
                                {formatDateTime(t.created_at)}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground font-mono text-xs">
                                {formatDateTime(t.expires_at)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span
                                  className={`inline-block text-[10px] px-2 py-0.5 ${toneClasses[status.tone]}`}
                                >
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <TokenRowMenu
                                  isUsed={t.used}
                                  onCopy={() => copyTokenLink(t.token)}
                                  onArchive={() =>
                                    setArchiving({
                                      kind: "token",
                                      id: t.id,
                                      name: t.prospect_nom,
                                    })
                                  }
                                />
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

      <ArchiveConfirmModal
        open={archiving !== null}
        onOpenChange={(o) => {
          if (!o) setArchiving(null);
        }}
        itemName={archiving?.name ?? ""}
        itemType={archiving?.kind === "token" ? "le lien" : "le brief"}
        onConfirm={handleConfirmArchive}
      />
    </>
  );
}

function BriefRowMenu({
  onArchive,
  briefId,
}: {
  onArchive: () => void;
  briefId: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/briefs/${briefId}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            Voir détail
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onArchive}
          className="text-warning focus:text-warning"
        >
          <Archive className="h-3.5 w-3.5" />
          Archiver
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TokenRowMenu({
  isUsed,
  onCopy,
  onArchive,
}: {
  isUsed: boolean;
  onCopy: () => void;
  onArchive: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isUsed && (
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copier le lien
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onArchive}
          className="text-warning focus:text-warning"
        >
          <Archive className="h-3.5 w-3.5" />
          Archiver
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
