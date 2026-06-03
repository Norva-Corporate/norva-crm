/**
 * Source unique des labels + variants + couleurs de statut par entité.
 *
 * Phase D6 du chantier d'audit : avant centralisation, chaque
 * composant ré-écrivait sa propre version (label only, label+variant,
 * label+color, ou tuple bg/text/border). On consolide ici les besoins
 * communs. Les rendus stylistiques très spécifiques (ex : InvoiceDetailClient
 * avec ses bg/text/border) peuvent dériver de `color` localement.
 */

import type {
  InvoiceStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/types";

export type StatusVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

export interface StatusConfig<T extends string> {
  key: T;
  label: string;
  variant: StatusVariant;
  /** Hex utilisé par reporting, progress bars, dots colorés. */
  color: string;
  /** % de complétion pour les barres de progression (projets). 0-100. */
  progress?: number;
}

// ============================================================
// Projects (progress requis)
// ============================================================
export const projectStatuses: Record<
  ProjectStatus,
  StatusConfig<ProjectStatus> & { progress: number }
> = {
    en_attente: {
      key: "en_attente",
      label: "En attente",
      variant: "secondary",
      color: "#8A99B8",
      progress: 0,
    },
    en_cours: {
      key: "en_cours",
      label: "En cours",
      variant: "default",
      color: "#3B7BF5",
      progress: 50,
    },
    en_pause: {
      key: "en_pause",
      label: "En pause",
      variant: "warning",
      color: "#F59E0B",
      progress: 50,
    },
    termine: {
      key: "termine",
      label: "Terminé",
      variant: "success",
      color: "#22C55E",
      progress: 100,
    },
    annule: {
      key: "annule",
      label: "Annulé",
      variant: "destructive",
      color: "#EF4444",
      progress: 0,
    },
  };

// ============================================================
// Invoices
// ============================================================
export const invoiceStatuses: Record<InvoiceStatus, StatusConfig<InvoiceStatus>> =
  {
    brouillon: {
      key: "brouillon",
      label: "Brouillon",
      variant: "secondary",
      color: "#8A99B8",
    },
    envoyee: {
      key: "envoyee",
      label: "Envoyée",
      variant: "default",
      color: "#3B7BF5",
    },
    payee: {
      key: "payee",
      label: "Payée",
      variant: "success",
      color: "#22C55E",
    },
    en_retard: {
      key: "en_retard",
      label: "En retard",
      variant: "destructive",
      color: "#EF4444",
    },
    annulee: {
      key: "annulee",
      label: "Annulée",
      variant: "secondary",
      color: "#8A99B8",
    },
  };

// ============================================================
// Tasks
// ============================================================
export const taskStatuses: Record<TaskStatus, StatusConfig<TaskStatus>> = {
  pending: {
    key: "pending",
    label: "À faire",
    variant: "secondary",
    color: "#8A99B8",
  },
  in_progress: {
    key: "in_progress",
    label: "En cours",
    variant: "default",
    color: "#3B7BF5",
  },
  done: {
    key: "done",
    label: "Terminée",
    variant: "success",
    color: "#22C55E",
  },
  cancelled: {
    key: "cancelled",
    label: "Annulée",
    variant: "outline",
    color: "#8A99B8",
  },
};

export const taskPriorities: Record<
  TaskPriority,
  { key: TaskPriority; label: string; color: string }
> = {
  low: { key: "low", label: "Basse", color: "text-muted-foreground" },
  normal: { key: "normal", label: "Normale", color: "text-foreground" },
  high: { key: "high", label: "Haute", color: "text-[#FB923C]" },
  urgent: { key: "urgent", label: "Urgente", color: "text-destructive" },
};

// ============================================================
// Helpers — listes ordonnées et accès rapide
// ============================================================
export const projectStatusList = Object.values(projectStatuses);
export const invoiceStatusList = Object.values(invoiceStatuses);
export const taskStatusList = Object.values(taskStatuses);

export function projectStatus(key: ProjectStatus) {
  return projectStatuses[key];
}
export function invoiceStatus(key: InvoiceStatus) {
  return invoiceStatuses[key];
}
export function taskStatus(key: TaskStatus) {
  return taskStatuses[key];
}
