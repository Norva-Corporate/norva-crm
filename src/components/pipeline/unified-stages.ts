import type { DealStage } from "@/types";
import type {
  LeadAssignee,
  LeadPipelineStage,
} from "@/lib/actions/leads";
import { TO_CONTACT_OWNERS } from "@/lib/team";
import { LEAD_STAGES } from "@/components/leads/stages";
import { STAGES as DEAL_STAGES } from "@/components/pipeline/stages";

/**
 * Colonnes du kanban unifié Pipeline (Phase B C2).
 * Concatène les stages Leads (prospection) et Deals (commercial),
 * séparés visuellement par un divider "Conversion".
 *
 * - kind: "lead"  → carte LeadCard, drag = updateLeadStage(+assignee)
 * - kind: "deal"  → carte DealCard, drag = updateDealStage
 * - Drag d'un lead vers une colonne deal = convertLeadToDeal(targetStage).
 * - Drag d'un deal vers une colonne lead = refusé (toast).
 */

export type UnifiedColumnKind = "lead" | "deal";

interface BaseColumn {
  /** Identifiant unique (utilisé comme `useDroppable.id`) */
  id: string;
  label: string;
  accent: string;
  description?: string;
}

export interface LeadColumn extends BaseColumn {
  kind: "lead";
  stage: LeadPipelineStage;
  /** Profile.id assigné si on drop ici (cas `to_contact` éclaté). Null = pas de split. */
  assignedTo: string | null;
}

export interface DealColumn extends BaseColumn {
  kind: "deal";
  stage: DealStage;
}

export type UnifiedColumn = LeadColumn | DealColumn;

/**
 * Construit la liste complète des colonnes du kanban unifié.
 * Les colonnes "Lead → À contacter" sont éclatées par owner
 * (Kylian, Lohan…) si les profils correspondants existent.
 */
export function buildUnifiedColumns(
  profiles: LeadAssignee[]
): UnifiedColumn[] {
  const profileByEmail = new Map<string, LeadAssignee>();
  for (const p of profiles) {
    if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
  }

  const cols: UnifiedColumn[] = [];

  for (const stage of LEAD_STAGES) {
    if (stage.key !== "to_contact") {
      cols.push({
        kind: "lead",
        id: `lead:${stage.key}`,
        stage: stage.key,
        assignedTo: null,
        label: stage.label,
        accent: stage.accent,
        description: stage.description,
      });
      continue;
    }
    // Split par owner
    for (const owner of TO_CONTACT_OWNERS) {
      const profile = profileByEmail.get(owner.email.toLowerCase());
      if (!profile) continue;
      cols.push({
        kind: "lead",
        id: `lead:to_contact:${profile.id}`,
        stage: "to_contact",
        assignedTo: profile.id,
        label: `${stage.label} — ${owner.shortName}`,
        accent: owner.accent,
        description: stage.description,
      });
    }
  }

  for (const stage of DEAL_STAGES) {
    cols.push({
      kind: "deal",
      id: `deal:${stage.key}`,
      stage: stage.key,
      label: stage.label,
      accent: stage.accent,
    });
  }

  return cols;
}

/**
 * Trouve la colonne d'un lead donné (utilisé pour le bucket initial
 * et le drag-over hit-test quand on survole une autre carte plutôt
 * que la zone de colonne).
 */
export function getLeadColumnId(
  stage: LeadPipelineStage,
  assignedTo: string | null,
  columns: UnifiedColumn[]
): string | null {
  if (stage !== "to_contact") return `lead:${stage}`;
  const col = columns.find(
    (c) =>
      c.kind === "lead" &&
      c.stage === "to_contact" &&
      c.assignedTo === assignedTo
  );
  return col?.id ?? null;
}

/** Trouve la colonne d'un deal donné. */
export function getDealColumnId(stage: DealStage): string {
  return `deal:${stage}`;
}

/** Index booléen pour insérer le séparateur visuel "Conversion". */
export function isConversionBoundary(
  prev: UnifiedColumn,
  next: UnifiedColumn
): boolean {
  return prev.kind === "lead" && next.kind === "deal";
}
