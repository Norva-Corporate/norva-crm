"use client";
import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Calendar,
  User,
  Building2,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectDrawer } from "@/components/projets/ProjectDrawer";
import { InvoiceDrawer } from "@/components/facturation/InvoiceDrawer";
import { ActivityTimeline } from "@/components/activity-timeline";
import { EntityTags } from "@/components/tags/entity-tags";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Activity,
  Project,
  ProjectStatus,
  InvoiceStatus,
  DocumentType,
  Tag,
} from "@/types";

const STATUS_CONFIG: Record<
  ProjectStatus,
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "destructive";
    color: string;
  }
> = {
  en_attente: { label: "En attente", variant: "secondary", color: "#8A99B8" },
  en_cours: { label: "En cours", variant: "default", color: "#3B7BF5" },
  en_pause: { label: "En pause", variant: "warning", color: "#F59E0B" },
  termine: { label: "Terminé", variant: "success", color: "#22C55E" },
  annule: { label: "Annulé", variant: "destructive", color: "#EF4444" },
};

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

interface InvoiceLite {
  id: string;
  number: string;
  type: DocumentType;
  status: InvoiceStatus;
  total: number;
  due_date: string | null;
  issue_date: string;
  created_at: string;
}

type ProjectDetail = Project & {
  deal: {
    id: string;
    title: string;
    value: number | null;
    contact?: { id: string; first_name: string; last_name: string } | null;
    company?: { id: string; name: string } | null;
  } | null;
  assignee: { id: string; full_name: string | null } | null;
  invoices: InvoiceLite[];
};

interface Props {
  project: ProjectDetail;
  deals: { id: string; title: string }[];
  profiles: { id: string; full_name: string | null }[];
  projects: { id: string; name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  activities?: (Activity & {
    author?: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  })[];
  tags?: Tag[];
}

export function ProjectDetailClient({
  project,
  deals,
  profiles,
  projects,
  contacts,
  companies,
  activities = [],
  tags = [],
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [, startTransition] = useTransition();

  const sc = STATUS_CONFIG[project.status];

  const facturationStats = useMemo(() => {
    const facture = project.invoices
      .filter((i) => i.type === "invoice" && i.status !== "annulee")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    const encaisse = project.invoices
      .filter((i) => i.status === "payee")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    return { facture, encaisse };
  }, [project.invoices]);

  const dateProgress = useMemo(() => {
    if (!project.start_date || !project.end_date) return null;
    const start = new Date(project.start_date).getTime();
    const end = new Date(project.end_date).getTime();
    const today = Date.now();
    if (end <= start) return null;
    const pct = Math.max(0, Math.min(100, ((today - start) / (end - start)) * 100));
    const overdue = today > end && project.status !== "termine";
    return { pct, overdue };
  }, [project.start_date, project.end_date, project.status]);

  function handleSuccess() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="flex-1 p-6 animate-fade-in space-y-4">
        {/* Top nav */}
        <Link
          href="/dashboard/projets"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Tous les projets
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">
              {project.name}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={sc.variant}>{sc.label}</Badge>
              {project.budget != null && (
                <span className="text-xs text-muted-foreground font-mono">
                  Budget : {formatCurrency(project.budget)}
                </span>
              )}
            </div>
            <EntityTags
              entityType="project"
              entityId={project.id}
              initialTags={tags}
              className="pt-1"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        </div>

        {/* Infos grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
              Informations
            </h2>
            <InfoRow icon={User} label="Client">
              {project.deal?.contact ? (
                <Link
                  href={`/dashboard/contacts/${project.deal.contact.id}`}
                  className="text-sm text-foreground hover:text-accent"
                >
                  {project.deal.contact.first_name} {project.deal.contact.last_name}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </InfoRow>
            <InfoRow icon={Building2} label="Entreprise">
              {project.deal?.company ? (
                <Link
                  href={`/dashboard/companies/${project.deal.company.id}`}
                  className="text-sm text-foreground hover:text-accent"
                >
                  {project.deal.company.name}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </InfoRow>
            <InfoRow icon={TrendingUp} label="Deal lié">
              {project.deal ? (
                <span className="text-sm text-foreground">
                  {project.deal.title}
                  {project.deal.value != null && (
                    <span className="text-muted-foreground ml-2 font-mono">
                      {formatCurrency(project.deal.value)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </InfoRow>
            <InfoRow icon={User} label="Responsable">
              <span className="text-sm text-foreground">
                {project.assignee?.full_name ?? "Non assigné"}
              </span>
            </InfoRow>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
              Calendrier
            </h2>
            <InfoRow icon={Calendar} label="Début">
              <span className="text-sm text-foreground font-mono">
                {formatDate(project.start_date)}
              </span>
            </InfoRow>
            <InfoRow icon={Calendar} label="Fin prévue">
              <span className="text-sm text-foreground font-mono">
                {formatDate(project.end_date)}
              </span>
            </InfoRow>

            {dateProgress && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Avancement temporel</span>
                  <span className="font-mono">{Math.round(dateProgress.pct)}%</span>
                </div>
                <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${dateProgress.pct}%`,
                      backgroundColor: dateProgress.overdue ? "#EF4444" : sc.color,
                    }}
                  />
                </div>
                {dateProgress.overdue && (
                  <p className="text-[10px] text-destructive">
                    Date de fin dépassée
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Notes */}
        {project.description && (
          <Card className="p-4">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Notes
            </h2>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {project.description}
            </p>
          </Card>
        )}

        {/* Invoices */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
              Factures liées ({project.invoices.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInvoiceOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle facture
            </Button>
          </div>

          {project.invoices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Aucune facture liée à ce projet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Numéro
                      </th>
                      <th className="text-right py-2 font-medium text-muted-foreground">
                        Montant
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Échéance
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Payée le
                      </th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {project.invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="py-2">
                          <Link
                            href={`/dashboard/facturation/${inv.id}`}
                            className="flex items-center gap-1.5 text-foreground hover:text-accent font-mono"
                          >
                            <FileText className="h-3 w-3" />
                            {inv.number}
                          </Link>
                        </td>
                        <td className="py-2 text-right font-mono text-foreground">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="py-2">
                          <span className="text-muted-foreground">
                            {INVOICE_STATUS_LABEL[inv.status]}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground font-mono">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="py-2 text-muted-foreground font-mono">
                          {inv.status === "payee"
                            ? formatDate(inv.issue_date)
                            : "—"}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-6 pt-2 border-t border-[var(--border)] text-xs">
                <div>
                  <span className="text-muted-foreground">Total facturé : </span>
                  <span className="text-foreground font-mono font-medium">
                    {formatCurrency(facturationStats.facture)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Encaissé : </span>
                  <span className="text-success font-mono font-medium">
                    {formatCurrency(facturationStats.encaisse)}
                  </span>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Activity timeline */}
        <ActivityTimeline
          entityType="project"
          entityId={project.id}
          initialActivities={activities}
        />
      </div>

      <ProjectDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        deals={deals}
        profiles={profiles}
        onSuccess={handleSuccess}
      />

      <InvoiceDrawer
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        projects={projects}
        contacts={contacts}
        companies={companies}
        defaultProjectId={project.id}
        onSuccess={handleSuccess}
      />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div>{children}</div>
      </div>
    </div>
  );
}
