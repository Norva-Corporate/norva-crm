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
  MoreHorizontal,
  X,
  CheckSquare,
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
import {
  convertLeadToDeal,
  dismissLead,
  qualifyLead,
  updateLeadStage,
} from "@/lib/actions/leads";
import type { LeadPipelineStage, LeadWithDedup } from "@/lib/actions/leads";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeadCardProps {
  lead: LeadWithDedup;
  onOpen: (lead: LeadWithDedup) => void;
  /** Callback appelé après dismiss / qualify côté carte — permet au parent de retirer/maj le lead dans son state. */
  onLeadChanged?: (
    leadId: string,
    change: { dismissed?: true; qualified?: true; coldEmailed?: true }
  ) => void;
  /** Pour le DragOverlay : rend la card sans le hook sortable */
  overlay?: boolean;
  /** Mode mobile : pas de drag handle, affiche un select de stage */
  mobile?: boolean;
  /** Callback appelé après changement de stage (en mode mobile) */
  onStageChanged?: (newStage: LeadPipelineStage) => void;
  /** Bulk select — état de cochage côté parent. */
  selected?: boolean;
  /** Bulk select — toggle déclenché par le click sur la checkbox. */
  onToggleSelect?: (leadId: string) => void;
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
  onLeadChanged,
  overlay = false,
  mobile = false,
  onStageChanged,
  selected = false,
  onToggleSelect,
}: LeadCardProps) {
  // Quand une card est cochée, on désactive son drag pour signaler
  // visuellement qu'on est en mode "bulk-edit" sur cette carte.
  // Le mode reste actif tant qu'il y a au moins 1 lead coché côté parent.
  const sortable = useSortable({
    id: lead.id,
    data: { type: "lead", stage: lead.pipeline_stage },
    disabled: overlay || mobile || selected,
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
  const [actionPending, startActionTransition] = useTransition();

  function handleDismiss(e: React.MouseEvent | Event) {
    e.stopPropagation();
    startActionTransition(async () => {
      const res = await dismissLead(lead.id);
      if (!res.success) {
        toast.error(res.error ?? "Impossible de rejeter le lead.");
        return;
      }
      toast.success("Lead rejeté.");
      onLeadChanged?.(lead.id, { dismissed: true });
    });
  }

  function handleQualify(e: React.MouseEvent | Event) {
    e.stopPropagation();
    if (lead.status !== "pending") return;
    startActionTransition(async () => {
      const res = await qualifyLead(lead.id);
      if (!res.success) {
        toast.error(res.error ?? "Impossible de qualifier le lead.");
        return;
      }
      toast.success("Lead qualifié.");
      onLeadChanged?.(lead.id, { qualified: true });
    });
  }

  function handleColdEmail(e: React.MouseEvent | Event) {
    e.stopPropagation();
    startActionTransition(async () => {
      const res = await updateLeadStage(lead.id, "to_email");
      if (!res.success) {
        toast.error(res.error ?? "Impossible de mettre en file cold email.");
        return;
      }
      toast.success("Mis en file cold email — visible dans Campagnes.");
      onLeadChanged?.(lead.id, { coldEmailed: true });
    });
  }

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
        overlay && "shadow-card-hover ring-1 ring-accent/40 cursor-grabbing",
        selected && "ring-1 ring-accent border-accent/60 bg-[#243557]"
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
        {/* Colonne gauche : checkbox bulk-select + drag handle.
            Checkbox visible toujours quand onToggleSelect est fourni (mode
            kanban desktop). Quand selected, le drag est désactivé donc on
            cache le grip et on met en avant la checkbox. */}
        {!mobile && (
          <div className="shrink-0 -ml-1 flex flex-col items-center gap-1 mt-0.5">
            {onToggleSelect && !overlay && (
              <button
                type="button"
                aria-label={selected ? "Désélectionner" : "Sélectionner ce lead"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(lead.id);
                }}
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 border rounded-sm transition-all",
                  selected
                    ? "bg-accent border-accent text-white opacity-100"
                    : "bg-[var(--background)]/70 border-[var(--border)] hover:border-accent/60 opacity-40 group-hover:opacity-100"
                )}
              >
                {selected && (
                  <svg
                    viewBox="0 0 12 12"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )}
            {!selected && (
              <button
                type="button"
                aria-label="Déplacer"
                className={cn(
                  "text-muted-foreground/60 hover:text-foreground",
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
          </div>
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
              {/* Menu d'actions — visible sauf en overlay / mobile.
                  Permet d'accéder à 'Rejeter' / 'Qualifier' sans ouvrir
                  le drawer. Le lead reste en DB (dismissLead set
                  status='dismissed') → pas de doublon en futur scraping. */}
              {!overlay && !mobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Actions sur le lead"
                      className="shrink-0 -mr-1 inline-flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      disabled={actionPending}
                    >
                      {actionPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {lead.status === "pending" && (
                      <DropdownMenuItem onSelect={handleQualify}>
                        <CheckSquare className="h-3.5 w-3.5" />
                        Marquer qualifié
                      </DropdownMenuItem>
                    )}
                    {lead.email && lead.pipeline_stage !== "to_email" && (
                      <DropdownMenuItem onSelect={handleColdEmail}>
                        <Send className="h-3.5 w-3.5" />
                        Mettre en cold email
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={handleDismiss}
                      className="text-destructive focus:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rejeter
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Entreprise */}
          {lead.company_name && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate min-w-0">{lead.company_name}</span>
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
