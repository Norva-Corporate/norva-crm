"use client";
import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Building2,
  Mail,
  Phone,
  UserCheck,
  UserX,
  ShieldCheck,
  AlertCircle,
  XCircle,
  HelpCircle,
  Star,
  Clock,
  Gauge,
  Globe,
  Send,
  Loader2,
  Hourglass,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelativeDate } from "@/lib/utils";
import {
  LEAD_STAGES,
  getLeadOwner,
  getLeadStage,
  getQualityLevel,
  isRecommendedForContact,
  getStagnationLevel,
  stagnationDays,
  QUALITY_COLOR,
  QUALITY_LABEL,
  STAGNATION_COLOR,
} from "./stages";
import { AgentButton } from "@/components/agents/agent-button";
import { convertLeadToDeal, updateLeadStage } from "@/lib/actions/leads";
import type { LeadPipelineStage, LeadWithDedup } from "@/lib/actions/leads";

interface LeadCardProps {
  lead: LeadWithDedup;
  onOpen: (lead: LeadWithDedup) => void;
  /** Pour le DragOverlay : rend la card sans le hook sortable */
  overlay?: boolean;
  /** Mode mobile : pas de drag handle, affiche un select de stage */
  mobile?: boolean;
  /** Callback appelé après changement de stage (en mode mobile) */
  onStageChanged?: (newStage: LeadPipelineStage) => void;
}

// Les stages où on propose des actions agent / conversion
const ACTION_STAGES: LeadWithDedup["pipeline_stage"][] = [
  "to_contact",
  "to_email",
  "contacted",
  "in_discussion",
];

function LeadCardImpl({
  lead,
  onOpen,
  overlay = false,
  mobile = false,
  onStageChanged,
}: LeadCardProps) {
  const sortable = useSortable({
    id: lead.id,
    data: { type: "lead", stage: lead.pipeline_stage },
    disabled: overlay || mobile,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style: React.CSSProperties = overlay || mobile
    ? {}
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  const [stagePending, startStageTransition] = useTransition();

  function handleStageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const newStage = e.target.value as LeadPipelineStage;
    if (newStage === lead.pipeline_stage) return;
    startStageTransition(async () => {
      const res = await updateLeadStage(lead.id, newStage);
      if (!res.success) {
        toast.error("Impossible de changer le stage");
        return;
      }
      onStageChanged?.(newStage);
    });
  }

  const stageDef = getLeadStage(lead.pipeline_stage);
  const accentBorder = stageDef.accent;
  const qualityLevel = getQualityLevel(lead.quality_score);
  const owner = getLeadOwner(lead.assignee);
  const recommended = isRecommendedForContact(
    lead.pipeline_stage,
    lead.quality_score
  );
  const stagnation = getStagnationLevel(
    lead.pipeline_stage,
    lead.stage_updated_at
  );
  const days = stagnation ? stagnationDays(lead.stage_updated_at) : 0;
  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    "(Sans nom)";

  // Site dispo ? On regarde company_domain et raw_payload.website
  const hasWebsite =
    !!lead.company_domain ||
    !!(lead.raw_payload &&
      typeof (lead.raw_payload as Record<string, unknown>).website === "string");

  const showActions =
    !overlay && ACTION_STAGES.includes(lead.pipeline_stage);
  const showCreateDeal = !overlay && lead.pipeline_stage === "in_discussion";

  return (
    <div
      ref={overlay || mobile ? undefined : setNodeRef}
      style={style}
      className={cn(
        "group relative bg-[#1C2A44] border border-[var(--border)] border-l-2 p-3 cursor-pointer transition-all",
        "hover:border-accent/30 hover:shadow-card-hover",
        isDragging && !overlay && "opacity-40",
        overlay && "shadow-card-hover ring-1 ring-accent/40 cursor-grabbing"
      )}
      data-stage={lead.pipeline_stage}
      onClick={() => !isDragging && onOpen(lead)}
    >
      {/* Border-left coloré selon stage */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{ background: accentBorder }}
      />

      <div className="flex items-start gap-2">
        {/* Drag handle — caché en mode mobile */}
        {!mobile && (
          <button
            type="button"
            aria-label="Déplacer"
            className={cn(
              "shrink-0 mt-0.5 -ml-1 text-muted-foreground/60 hover:text-foreground",
              "cursor-grab active:cursor-grabbing transition-colors",
              "opacity-50 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header — nom + score qualité + badge ⭐ recommandé */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-tight truncate">
                {fullName}
              </p>
              {lead.role && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {lead.role}
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {owner && (
                <span
                  title={`Assigné à ${owner.shortName}`}
                  className="inline-flex items-center justify-center h-4 w-4 text-[9px] font-mono font-bold uppercase rounded-full"
                  style={{
                    background: `${owner.accent}25`,
                    color: owner.accent,
                    border: `1px solid ${owner.accent}55`,
                  }}
                >
                  {owner.shortName[0]}
                </span>
              )}
              {recommended && (
                <span
                  title="Recommandé pour contact (qualité ≥ 80)"
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-semibold uppercase tracking-wider"
                >
                  <Star className="h-2.5 w-2.5 fill-current" />
                  À attaquer
                </span>
              )}
              {qualityLevel && (
                <span
                  title={`${QUALITY_LABEL[qualityLevel]} — quality_score ${lead.quality_score}/100`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono tabular-nums"
                  style={{
                    background: `${QUALITY_COLOR[qualityLevel]}20`,
                    color: QUALITY_COLOR[qualityLevel],
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: QUALITY_COLOR[qualityLevel] }}
                  />
                  {lead.quality_score}
                </span>
              )}
            </div>
          </div>

          {/* Entreprise */}
          {lead.company_name && (
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.company_name}</span>
              {lead.existing_company_id && (
                <span
                  title="Entreprise déjà en base"
                  className="ml-1 text-[9px] text-accent shrink-0"
                >
                  •
                </span>
              )}
            </p>
          )}

          {/* Signal banner — doublon possible */}
          {lead.existing_contact_id && (
            <div className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-1.5 py-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              Doublon possible
            </div>
          )}

          {/* Footer — indicateurs vérification + stagnation + date */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <EmailIndicator
                status={lead.email_verified}
                hasEmail={!!lead.email}
              />
              {lead.phone && (
                <Phone className="h-3 w-3" aria-label="Téléphone" />
              )}
              <LinkedInIndicator verified={lead.linkedin_verified} />
              <CompanyActiveIndicator active={lead.company_active} />
              {lead.pagespeed_score != null && (
                <PageSpeedIndicator score={lead.pagespeed_score} />
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {stagnation && (
                <span
                  title={`Aucune action depuis ${days} jours`}
                  className="inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums px-1 py-0.5"
                  style={{
                    color: STAGNATION_COLOR[stagnation],
                    background: `${STAGNATION_COLOR[stagnation]}15`,
                  }}
                >
                  <Hourglass className="h-2.5 w-2.5" />
                  {days}j
                </span>
              )}
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                <Clock className="h-2.5 w-2.5" />
                {formatRelativeDate(lead.imported_at)}
              </p>
            </div>
          </div>

          {/* Actions — boutons agent + bouton conversion */}
          {(showActions || showCreateDeal) && (
            <div
              className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]/50"
              onClick={(e) => e.stopPropagation()}
            >
              {showActions && (
                <>
                  <AgentButton
                    agent="premier-contact"
                    entityType="lead_import"
                    entityId={lead.id}
                    shortLabel=""
                    icon={Send}
                    label="Kit premier contact"
                    successMessage="Kit contact en file. Lance l'agent dans multica."
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                  />
                  {hasWebsite && (
                    <AgentButton
                      agent="audit-site"
                      entityType="lead_import"
                      entityId={lead.id}
                      shortLabel=""
                      icon={Globe}
                      label="Audit du site"
                      successMessage="Audit en file. Lance l'agent dans multica."
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                    />
                  )}
                </>
              )}
              {showCreateDeal && (
                <CreateDealButton leadId={lead.id} className="ml-auto" />
              )}
            </div>
          )}

          {/* Mobile : sélecteur de stage à la place du drag */}
          {mobile && (
            <div
              className="pt-2 border-t border-[var(--border)]/50"
              onClick={(e) => e.stopPropagation()}
            >
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="shrink-0">Stage :</span>
                <select
                  value={lead.pipeline_stage}
                  onChange={handleStageChange}
                  onClick={(e) => e.stopPropagation()}
                  disabled={stagePending}
                  className="flex-1 h-7 px-1.5 text-[11px] bg-[var(--background)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent"
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {stagePending && <Loader2 className="h-3 w-3 animate-spin" />}
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// React.memo : évite les rerenders inutiles dans le kanban quand une autre
// carte change. Comparaison superficielle suffit — les callbacks (onOpen,
// onStageChanged) sont stabilisés en amont via useCallback.
export const LeadCard = React.memo(LeadCardImpl);

// ============================================================
// Bouton "→ Créer deal" (stage='in_discussion')
// ============================================================

function CreateDealButton({
  leadId,
  className,
}: {
  leadId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const res = await convertLeadToDeal(leadId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Deal créé en pipeline. Conversion réussie.");
      router.push("/dashboard/pipeline");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-7 text-[11px] font-medium",
        "bg-[#22C55E]/15 text-[#22C55E] hover:bg-[#22C55E]/25 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      title="Convertir en contact + deal en pipeline"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ArrowRight className="h-3 w-3" />
      )}
      Créer deal
    </button>
  );
}

// ============================================================
// Sub-indicators
// ============================================================

function EmailIndicator({
  status,
  hasEmail,
}: {
  status: LeadCardProps["lead"]["email_verified"];
  hasEmail: boolean;
}) {
  if (!hasEmail) return null;
  const tone =
    status === "valid"
      ? { Icon: ShieldCheck, color: "#22C55E", label: "Email vérifié" }
      : status === "invalid"
      ? { Icon: XCircle, color: "#EF4444", label: "Email invalide" }
      : status === "risky"
      ? { Icon: AlertCircle, color: "#F59E0B", label: "Email risqué" }
      : { Icon: Mail, color: "#64748B", label: "Email non vérifié" };
  return (
    <tone.Icon
      className="h-3 w-3"
      style={{ color: tone.color }}
      aria-label={tone.label}
    />
  );
}

function LinkedInIndicator({ verified }: { verified: boolean }) {
  const Icon = verified ? UserCheck : UserX;
  return (
    <Icon
      className="h-3 w-3"
      style={{ color: verified ? "#3B82F6" : "#475569" }}
      aria-label={verified ? "LinkedIn vérifié" : "LinkedIn non vérifié"}
    />
  );
}

function CompanyActiveIndicator({ active }: { active: boolean | null }) {
  if (active === null) {
    return (
      <HelpCircle
        className="h-3 w-3 text-muted-foreground/40"
        aria-label="Activité entreprise inconnue"
      />
    );
  }
  return active ? (
    <Building2
      className="h-3 w-3"
      style={{ color: "#22C55E" }}
      aria-label="Entreprise active"
    />
  ) : (
    <XCircle
      className="h-3 w-3"
      style={{ color: "#EF4444" }}
      aria-label="Entreprise radiée ou en procédure"
    />
  );
}

function PageSpeedIndicator({ score }: { score: number }) {
  const color =
    score < 30 ? "#EF4444" : score < 70 ? "#F59E0B" : "#22C55E";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-mono"
      style={{ color }}
      title={`PageSpeed mobile : ${score}/100`}
    >
      <Gauge className="h-3 w-3" />
      <span className="tabular-nums">{score}</span>
    </span>
  );
}
