"use client";
import React, { useEffect, useState, useTransition } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineText } from "@/components/ui/inline-text";
import { InlinePicker } from "@/components/ui/inline-picker";
import { ActivityTimeline } from "@/components/activity-timeline";
import { EntityTags } from "@/components/tags/entity-tags";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Star,
  X,
  Loader,
  Trophy,
  ArrowRight,
  MapPin,
  Building2,
  FileText,
  Briefcase,
  Globe,
  BookText,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  convertLead,
  dismissLead,
  qualifyLead,
  updateLead,
  getLeadDetails,
  type LeadAssignee,
  type LeadUpdatePatch,
  type LeadWithDedup,
} from "@/lib/actions/leads";
import type { Activity, Tag } from "@/types";
import { cn } from "@/lib/utils";

const NEW_COMPANY = "__new__";
const NO_COMPANY = "__none__";

const TEMPERATURE_OPTIONS = [
  { value: "cold", label: "🔵 Froid" },
  { value: "warm", label: "🟡 Tiède" },
  { value: "hot", label: "🔥 Chaud" },
];

const STATUS_BADGE: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  pending: { label: "À traiter", variant: "default" },
  qualified: { label: "Qualifié", variant: "warning" },
  converted: { label: "Converti", variant: "success" },
  dismissed: { label: "Rejeté", variant: "secondary" },
  duplicate: { label: "Doublon", variant: "warning" },
};

interface Props {
  lead: LeadWithDedup | null;
  companies: { id: string; name: string }[];
  profiles: LeadAssignee[];
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LeadDrawer({
  lead: leadProp,
  companies,
  profiles,
  onOpenChange,
  onSuccess,
}: Props) {
  const [convertMode, setConvertMode] = useState(false);
  const [companyChoice, setCompanyChoice] = useState<string>(NO_COMPANY);
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // État local du lead — mirror du prop, mis à jour aussi après chaque save
  // inline (saveText, saveDateField, saveBudget, saveScore) pour que l'UI
  // reflète le nouveau état sans attendre un re-fetch du parent. Sans ça,
  // useInlineOptimistic reset à la propValue (= ancienne valeur) après la
  // transition → user pense que la sauvegarde a échoué.
  const [lead, setLead] = useState<LeadWithDedup | null>(leadProp);

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [associatedDeal, setAssociatedDeal] = useState<{
    id: string;
    title: string;
    stage: string;
  } | null>(null);

  // Sync lead state avec le prop quand on ouvre un autre lead.
  useEffect(() => {
    setLead(leadProp);
  }, [leadProp]);

  useEffect(() => {
    if (!leadProp) return;
    setConvertMode(false);
    setError(null);
    if (leadProp.existing_company_id) {
      setCompanyChoice(leadProp.existing_company_id);
      setCompanyName("");
      setCompanyDomain("");
    } else if (leadProp.company_name || leadProp.company_domain) {
      setCompanyChoice(NEW_COMPANY);
      setCompanyName(leadProp.company_name ?? "");
      setCompanyDomain(leadProp.company_domain ?? "");
    } else {
      setCompanyChoice(NO_COMPANY);
      setCompanyName("");
      setCompanyDomain("");
    }
    setActivities(null);
    setTags(null);
    setAssociatedDeal(null);
    let cancelled = false;
    getLeadDetails(leadProp.id).then((d) => {
      if (cancelled) return;
      setActivities(d.activities as unknown as Activity[]);
      setTags(d.tags);
      setAssociatedDeal(d.associatedDeal);
    });
    return () => {
      cancelled = true;
    };
  }, [leadProp]);

  if (!lead) {
    return (
      <Drawer open={false} onOpenChange={() => onOpenChange(false)}>
        <DrawerContent />
      </Drawer>
    );
  }

  // Capture id + initial values for stable closures.
  const leadId = lead.id;

  // Helper unifié pour tous les saves inline : optimistic update du state
  // local AVANT le server call (évite le flash de retour à l'ancienne
  // valeur causé par useInlineOptimistic qui reset son override à
  // propValue à la fin de la transition). En cas d'erreur serveur, on
  // rollback automatiquement aux valeurs précédentes + toast d'erreur.
  async function saveAndUpdate(patch: LeadUpdatePatch) {
    // 1) Capture les valeurs actuelles pour rollback éventuel
    const rollback: LeadUpdatePatch = {};
    if (lead) {
      for (const key of Object.keys(patch) as (keyof LeadUpdatePatch)[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rollback as any)[key] = (lead as any)[key] ?? null;
      }
    }

    // 2) Optimistic update — le rendu reflète la nouvelle valeur dès
    //    avant la réponse serveur.
    setLead((prev) =>
      prev ? ({ ...prev, ...patch } as LeadWithDedup) : prev
    );

    // 3) Server save
    const res = await updateLead(leadId, patch);

    if (!res.success) {
      // 4) Rollback
      setLead((prev) =>
        prev ? ({ ...prev, ...rollback } as LeadWithDedup) : prev
      );
    }
    return res;
  }

  // Generic per-field saver. The form controls (InlineText/InlinePicker) all
  // hand back string|null, so we wrap that into the typed patch shape.
  function saveText(key: keyof LeadUpdatePatch) {
    return async (next: string | null) => {
      return saveAndUpdate({ [key]: next } as LeadUpdatePatch);
    };
  }

  // Numeric save: parse string -> number.
  async function saveBudget(next: string | null) {
    const num = next != null && next !== "" ? Number(next) : null;
    if (num != null && Number.isNaN(num)) {
      return { success: false as const, error: "Montant invalide." };
    }
    return saveAndUpdate({ estimated_budget: num });
  }

  // Score save: integer 1-5 or null.
  async function saveScore(next: number | null) {
    return saveAndUpdate({ qualification_score: next });
  }

  // Date save for next_follow_up_at — input date returns YYYY-MM-DD which
  // Postgres casts cleanly to timestamptz.
  function saveDateField(key: keyof LeadUpdatePatch) {
    return async (next: string | null) => {
      return saveAndUpdate({ [key]: next } as LeadUpdatePatch);
    };
  }

  function handleConvert() {
    setError(null);
    // Identity fields (first/last/email/phone/role) are autosaved through the
    // inline editors, so we don't need to pass them here — convertLead will
    // read them fresh from the database.
    const overrides: Parameters<typeof convertLead>[1] = {};
    if (companyChoice === NO_COMPANY) {
      overrides.company_id = null;
    } else if (companyChoice === NEW_COMPANY) {
      overrides.company_id = null;
      overrides.company_name = companyName;
      overrides.company_domain = companyDomain;
    } else {
      overrides.company_id = companyChoice;
    }
    startTransition(async () => {
      const res = await convertLead(leadId, overrides);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess?.();
    });
  }

  function handleQualify() {
    startTransition(async () => {
      const res = await qualifyLead(leadId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onSuccess?.();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const res = await dismissLead(leadId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onSuccess?.();
    });
  }

  const isPending = lead.status === "pending";
  const isQualified = lead.status === "qualified";
  const canConvert = isPending || isQualified;
  const canQualify = isPending;
  const statusBadge = STATUS_BADGE[lead.status];

  return (
    <Drawer
      open={!!lead}
      onOpenChange={(o) => !pending && onOpenChange(o)}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 pr-8">
            <Sparkles className="h-4 w-4 text-accent shrink-0" />
            <span className="truncate">
              {convertMode
                ? "Convertir en contact"
                : [lead.first_name, lead.last_name]
                    .filter(Boolean)
                    .join(" ") || "Lead sans nom"}
            </span>
            {!convertMode && statusBadge && (
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            {convertMode
              ? "Choisis l'entreprise à associer au contact créé."
              : "Édite les infos, ajoute des notes, qualifie puis convertis quand tu es prêt."}
          </DrawerDescription>
        </DrawerHeader>

        {convertMode ? (
          <DrawerBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Entreprise</Label>
              <Select value={companyChoice} onValueChange={setCompanyChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>Aucune</SelectItem>
                  <SelectItem value={NEW_COMPANY}>
                    Créer une nouvelle entreprise
                  </SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {companyChoice === NEW_COMPANY && (
              <div className="grid grid-cols-1 gap-3 pl-3 border-l-2 border-accent/30">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Nom *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyDomain">Domaine</Label>
                  <Input
                    id="companyDomain"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="acme.com"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Le contact sera créé avec les infos d&apos;identité actuelles du
              lead ({lead.first_name} {lead.last_name}).
            </p>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                {error}
              </p>
            )}
          </DrawerBody>
        ) : (
          <DrawerBody className="space-y-5">
            {/* Deal associé — visible si le lead a été converti */}
            {associatedDeal && (
              <div className="flex items-start gap-2 px-2.5 py-2 bg-[#22C55E]/5 border border-[#22C55E]/30 text-xs">
                <Trophy className="h-3.5 w-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                    Deal créé depuis ce lead
                  </p>
                  <p className="text-foreground truncate">
                    {associatedDeal.title}
                  </p>
                </div>
                <Link
                  href="/dashboard/pipeline"
                  className="text-[#22C55E] hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Pipeline
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            <Section title="Identité">
              <FieldRow label="Prénom *">
                <InlineText
                  value={lead.first_name}
                  onSave={saveText("first_name")}
                  ariaLabel="Prénom"
                  required
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Nom *">
                <InlineText
                  value={lead.last_name}
                  onSave={saveText("last_name")}
                  ariaLabel="Nom"
                  required
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Email">
                <InlineText
                  value={lead.email}
                  onSave={saveText("email")}
                  ariaLabel="Email"
                  variant="email"
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Téléphone">
                <InlineText
                  value={lead.phone}
                  onSave={saveText("phone")}
                  ariaLabel="Téléphone"
                  variant="tel"
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Fonction">
                <InlineText
                  value={lead.role}
                  onSave={saveText("role")}
                  ariaLabel="Fonction"
                  placeholder="—"
                />
              </FieldRow>
            </Section>

            <Section title="Entreprise">
              <FieldRow label="Nom de l'entreprise">
                <InlineText
                  value={lead.company_name}
                  onSave={saveText("company_name")}
                  ariaLabel="Nom de l'entreprise"
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Domaine">
                <InlineText
                  value={lead.company_domain}
                  onSave={saveText("company_domain")}
                  ariaLabel="Domaine"
                  placeholder="acme.com"
                />
              </FieldRow>
              {lead.existing_company_id && lead.existing_company_name && (
                <p className="text-[11px] text-accent px-1 py-1">
                  ✓ Une entreprise{" "}
                  <span className="font-medium">
                    {lead.existing_company_name}
                  </span>{" "}
                  existe déjà en base — elle sera associée à la conversion.
                </p>
              )}
            </Section>

            <ExternalLinksSection lead={lead} />

            <Section title="Qualification">
              <FieldRow label="Assigné à">
                <InlinePicker
                  variant="select"
                  value={lead.assigned_to}
                  onSave={saveText("assigned_to")}
                  ariaLabel="Assigné à"
                  options={profiles.map((p) => ({
                    value: p.id,
                    label: p.full_name ?? "(Sans nom)",
                  }))}
                  allowEmpty
                  emptyLabel="—"
                />
              </FieldRow>
              <FieldRow label="Température">
                <InlinePicker
                  variant="select"
                  value={lead.temperature}
                  onSave={saveText("temperature")}
                  ariaLabel="Température"
                  options={TEMPERATURE_OPTIONS}
                  allowEmpty
                  emptyLabel="—"
                />
              </FieldRow>
              <FieldRow label="Score">
                <StarRating
                  value={lead.qualification_score}
                  onSave={saveScore}
                />
              </FieldRow>
              <FieldRow label="Prochaine relance">
                <InlinePicker
                  variant="date"
                  value={lead.next_follow_up_at?.slice(0, 10) ?? null}
                  onSave={saveDateField("next_follow_up_at")}
                  ariaLabel="Prochaine relance"
                />
              </FieldRow>
              <FieldRow label="Budget estimé (€)">
                <InlineText
                  value={
                    lead.estimated_budget != null
                      ? String(lead.estimated_budget)
                      : null
                  }
                  onSave={saveBudget}
                  ariaLabel="Budget estimé"
                  variant="number"
                  placeholder="—"
                />
              </FieldRow>
              <FieldRow label="Date closing prévue">
                <InlinePicker
                  variant="date"
                  value={lead.expected_close_date}
                  onSave={saveDateField("expected_close_date")}
                  ariaLabel="Date closing prévue"
                />
              </FieldRow>
            </Section>

            <Section title="Notes">
              <InlineText
                value={lead.notes}
                onSave={saveText("notes")}
                ariaLabel="Notes"
                variant="textarea"
                placeholder="Contexte du lead, points soulevés au premier contact…"
                rows={3}
              />
            </Section>

            <Section title="Tags">
              {tags === null ? (
                <SectionSkeleton />
              ) : (
                <EntityTags
                  entityType="lead_import"
                  entityId={leadId}
                  initialTags={tags}
                />
              )}
            </Section>


            {activities === null ? (
              <SectionSkeleton />
            ) : (
              <ActivityTimeline
                entityType="lead_import"
                entityId={leadId}
                initialActivities={activities}
              />
            )}
          </DrawerBody>
        )}

        <DrawerFooter>
          {convertMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setConvertMode(false)}
                disabled={pending}
              >
                Retour
              </Button>
              <Button
                onClick={handleConvert}
                disabled={
                  pending ||
                  (companyChoice === NEW_COMPANY && !companyName.trim())
                }
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer la conversion
              </Button>
            </>
          ) : canConvert ? (
            <>
              {canQualify && (
                <Button
                  variant="outline"
                  onClick={handleQualify}
                  disabled={pending}
                >
                  Marquer qualifié
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleDismiss}
                disabled={pending}
                title="Rejeter"
              >
                <X className="h-3.5 w-3.5" />
                Rejeter
              </Button>
              <Button
                onClick={() => setConvertMode(true)}
                disabled={
                  pending || !lead.first_name?.trim() || !lead.last_name?.trim()
                }
                title={
                  !lead.first_name?.trim() || !lead.last_name?.trim()
                    ? "Prénom et nom requis"
                    : undefined
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convertir en contact
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-1 py-1 hover:bg-[var(--muted)]/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </p>
        <div>{children}</div>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
      <Loader className="h-3 w-3 animate-spin" />
      Chargement…
    </div>
  );
}

// ============================================================
// External links — Google Maps, Societe.com, Pappers, LinkedIn,
// Site web, Pages Jaunes. Construits à la volée depuis raw_payload
// + colonnes du lead. N'affiche que les liens où la donnée existe.
// ============================================================

type ExternalLinkItem = {
  id: string;
  url: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function buildExternalLinks(lead: LeadWithDedup): ExternalLinkItem[] {
  const items: ExternalLinkItem[] = [];
  const payload = (lead.raw_payload ?? {}) as Record<string, unknown>;

  // 1. Google Maps — URL canonique si dispo, sinon construction depuis place_id
  const gmapsUrl =
    typeof payload.google_maps_url === "string"
      ? payload.google_maps_url
      : null;
  const placeId =
    typeof payload.place_id === "string" ? payload.place_id : null;
  if (gmapsUrl) {
    items.push({
      id: "gmaps",
      url: gmapsUrl,
      label: "Google Maps",
      Icon: MapPin,
    });
  } else if (placeId) {
    const cleanedId = placeId.startsWith("places/") ? placeId.slice(7) : placeId;
    items.push({
      id: "gmaps",
      url: `https://www.google.com/maps/place/?q=place_id:${cleanedId}`,
      label: "Google Maps",
      Icon: MapPin,
    });
  }

  // 2 & 3. Societe.com + Pappers — depuis SIREN
  const siren = typeof payload.siren === "string" ? payload.siren : null;
  if (siren) {
    items.push({
      id: "societe",
      url: `https://www.societe.com/cgi-bin/search?champs=${siren}`,
      label: "Societe.com",
      Icon: Building2,
    });
    items.push({
      id: "pappers",
      url: `https://www.pappers.fr/entreprise/${siren}`,
      label: "Pappers",
      Icon: FileText,
    });
  }

  // 4. LinkedIn dirigeant — URL directe depuis raw_payload
  const linkedin =
    typeof payload.linkedin === "string" ? payload.linkedin : null;
  if (linkedin) {
    items.push({
      id: "linkedin",
      url: linkedin,
      label: "LinkedIn dirigeant",
      Icon: Briefcase,
    });
  }

  // 5. Site web — depuis raw_payload.website ou company_domain
  const websiteRaw =
    typeof payload.website === "string" ? payload.website : null;
  const fallbackDomain = lead.company_domain;
  const finalWebsite = websiteRaw ?? fallbackDomain;
  if (finalWebsite) {
    const normalized = /^https?:\/\//i.test(finalWebsite)
      ? finalWebsite
      : `https://${finalWebsite}`;
    items.push({
      id: "website",
      url: normalized,
      label: "Site web",
      Icon: Globe,
    });
  }

  // 6. Pages Jaunes — depuis nom + ville
  const location =
    typeof payload.location === "string" ? payload.location : null;
  if (lead.company_name && location) {
    const params = new URLSearchParams({
      quoiqui: lead.company_name,
      ou: location,
    });
    items.push({
      id: "pagesjaunes",
      url: `https://www.pagesjaunes.fr/recherche/?${params.toString()}`,
      label: "Pages Jaunes",
      Icon: BookText,
    });
  }

  return items;
}

function ExternalLinksSection({ lead }: { lead: LeadWithDedup }) {
  const items = buildExternalLinks(lead);
  if (items.length === 0) return null;

  return (
    <Section title="Liens externes">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {items.map(({ id, url, label, Icon }) => (
          <a
            key={id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-[var(--muted)]/30 hover:text-accent transition-colors rounded-sm border border-transparent hover:border-[var(--border)]"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{label}</span>
            <ExternalLinkIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          </a>
        ))}
      </div>
    </Section>
  );
}

function StarRating({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (next: number | null) => Promise<
    { success: true; data: unknown } | { success: false; error: string }
  >;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const current = hover ?? value ?? 0;

  function handleClick(rating: number) {
    // Click the same rating twice = clear it
    const next = value === rating ? null : rating;
    startTransition(async () => {
      const res = await onSave(next);
      if (!res.success) toast.error(res.error);
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5",
        pending && "opacity-60"
      )}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= current;
        return (
          <button
            key={n}
            type="button"
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onClick={() => handleClick(n)}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            className={cn(
              "p-0.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm",
              filled
                ? "text-[#F59E0B]"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
          >
            <Star
              className="h-3.5 w-3.5"
              fill={filled ? "currentColor" : "none"}
            />
          </button>
        );
      })}
      {value != null && !pending && (
        <button
          type="button"
          onClick={() => handleClick(value)}
          aria-label="Effacer le score"
          className="ml-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          ✕
        </button>
      )}
    </div>
  );
}
