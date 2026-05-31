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
  ClipboardList,
  Download,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  AlertCircle,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectDrawer } from "@/components/projets/ProjectDrawer";
import { InvoiceDrawer } from "@/components/facturation/InvoiceDrawer";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { ActivityTimeline } from "@/components/activity-timeline";
import { EntityTags } from "@/components/tags/entity-tags";
import { InlineText } from "@/components/ui/inline-text";
import { InlinePicker } from "@/components/ui/inline-picker";
import { patchProject, type ProjectPatch } from "@/lib/actions/projects";
import {
  updateTaskStatus,
  type ProjectTaskRow,
} from "@/lib/actions/tasks";
import { getProjectColor } from "@/lib/project-color";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type {
  Activity,
  Project,
  ProjectStatus,
  InvoiceStatus,
  DocumentType,
  Tag,
  Task,
  TaskPriority,
  TaskStatus,
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
  contact: { id: string; first_name: string; last_name: string } | null;
  company: { id: string; name: string } | null;
  assignee: { id: string; full_name: string | null } | null;
  brief: {
    id: string;
    prospect_nom: string | null;
    submitted_at: string;
  } | null;
  invoices: InvoiceLite[];
};

interface Props {
  project: ProjectDetail;
  deals: { id: string; title: string }[];
  profiles: { id: string; full_name: string | null; email?: string | null }[];
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
  tasks?: ProjectTaskRow[];
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
  tasks = [],
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const projectColor = getProjectColor(project.id);

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

  function toggleTaskDone(t: ProjectTaskRow) {
    const next: TaskStatus = t.status === "done" ? "pending" : "done";
    startTransition(async () => {
      await updateTaskStatus(t.id, next);
      router.refresh();
    });
  }

  function openTaskCreate() {
    setEditingTask(null);
    setTaskOpen(true);
  }

  function openTaskEdit(t: ProjectTaskRow) {
    // Reconstruit un Task minimal pour le drawer
    setEditingTask({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      related_type: "project",
      related_id: project.id,
      assigned_to: t.assigned_to,
      created_by: "",
      created_at: t.created_at,
      updated_at: t.created_at,
    });
    setTaskOpen(true);
  }

  const patch =
    (field: keyof ProjectPatch) =>
    (value: string | null) =>
      patchProject(project.id, { [field]: value } as ProjectPatch);

  const patchBudget = (value: string | null) =>
    patchProject(project.id, {
      budget: value == null || value === "" ? null : Number(value),
    });

  const patchStatus = (value: string | null) =>
    patchProject(project.id, {
      status: (value ?? undefined) as ProjectStatus | undefined,
    });

  const statusOptions = (Object.keys(STATUS_CONFIG) as ProjectStatus[]).map(
    (key) => ({ value: key, label: STATUS_CONFIG[key].label })
  );

  const dealOptions = deals.map((d) => ({ value: d.id, label: d.title }));

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.full_name ?? p.id,
  }));

  const contactOptions = contacts.map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const contactDisplay = project.contact ?? project.deal?.contact ?? null;
  const companyDisplay = project.company ?? project.deal?.company ?? null;

  return (
    <>
      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
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
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-xl font-semibold text-foreground">
              <InlineText
                value={project.name}
                onSave={patch("name")}
                ariaLabel="Nom du projet"
                required
                placeholder="Nom du projet"
                className="max-w-[32rem]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <InlinePicker
                variant="select"
                value={project.status}
                onSave={patchStatus}
                ariaLabel="Statut"
                options={statusOptions}
                displayAs={(v) => {
                  const cfg = STATUS_CONFIG[v as ProjectStatus] ?? sc;
                  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
                }}
              />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                Budget :
                <InlineText
                  value={project.budget != null ? String(project.budget) : null}
                  onSave={patchBudget}
                  ariaLabel="Budget"
                  variant="number"
                  placeholder="0"
                  inputClassName="w-32"
                  displayAs={(v) => (
                    <span className="text-foreground">{formatCurrency(Number(v))}</span>
                  )}
                />
              </span>
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
              <InlinePicker
                variant="select"
                value={project.contact_id ?? null}
                onSave={patch("contact_id")}
                ariaLabel="Client"
                options={contactOptions}
                allowEmpty
                emptyLabel="Aucun client"
                displayAs={(id) => {
                  if (id) {
                    const c =
                      project.contact && project.contact.id === id
                        ? project.contact
                        : contacts.find((x) => x.id === id);
                    if (c) {
                      return (
                        <Link
                          href={`/dashboard/contacts/${c.id}`}
                          className="text-sm text-foreground hover:text-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                      );
                    }
                  }
                  if (contactDisplay) {
                    return (
                      <Link
                        href={`/dashboard/contacts/${contactDisplay.id}`}
                        className="text-sm text-muted-foreground italic hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contactDisplay.first_name} {contactDisplay.last_name} (du deal)
                      </Link>
                    );
                  }
                  return <span className="text-sm text-muted-foreground">—</span>;
                }}
              />
            </InfoRow>
            <InfoRow icon={Building2} label="Entreprise">
              <InlinePicker
                variant="select"
                value={project.company_id ?? null}
                onSave={patch("company_id")}
                ariaLabel="Entreprise"
                options={companyOptions}
                allowEmpty
                emptyLabel="Aucune entreprise"
                displayAs={(id) => {
                  if (id) {
                    const c =
                      project.company && project.company.id === id
                        ? project.company
                        : companies.find((x) => x.id === id);
                    if (c) {
                      return (
                        <Link
                          href={`/dashboard/companies/${c.id}`}
                          className="text-sm text-foreground hover:text-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                      );
                    }
                  }
                  if (companyDisplay) {
                    return (
                      <Link
                        href={`/dashboard/companies/${companyDisplay.id}`}
                        className="text-sm text-muted-foreground italic hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {companyDisplay.name} (du deal)
                      </Link>
                    );
                  }
                  return <span className="text-sm text-muted-foreground">—</span>;
                }}
              />
            </InfoRow>
            <InfoRow icon={TrendingUp} label="Deal lié">
              <InlinePicker
                variant="select"
                value={project.deal_id ?? null}
                onSave={patch("deal_id")}
                ariaLabel="Deal lié"
                options={dealOptions}
                allowEmpty
                emptyLabel="Aucun deal"
                displayAs={(id) => {
                  if (!id) return <span className="text-sm text-muted-foreground">—</span>;
                  const d =
                    project.deal && project.deal.id === id
                      ? project.deal
                      : null;
                  const label = d?.title ?? deals.find((x) => x.id === id)?.title;
                  return (
                    <span className="text-sm text-foreground">
                      {label ?? "—"}
                      {d?.value != null && (
                        <span className="text-muted-foreground ml-2 font-mono">
                          {formatCurrency(d.value)}
                        </span>
                      )}
                    </span>
                  );
                }}
              />
            </InfoRow>
            <InfoRow icon={User} label="Responsable">
              <InlinePicker
                variant="select"
                value={project.assigned_to ?? null}
                onSave={patch("assigned_to")}
                ariaLabel="Responsable"
                options={profileOptions}
                allowEmpty
                emptyLabel="Non assigné"
                displayAs={(id) => {
                  if (!id) return <span className="text-sm text-muted-foreground">Non assigné</span>;
                  const p = profiles.find((x) => x.id === id);
                  return (
                    <span className="text-sm text-foreground">
                      {p?.full_name ?? id}
                    </span>
                  );
                }}
              />
            </InfoRow>
            {project.brief && (
              <InfoRow icon={ClipboardList} label="Brief source">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/briefs/${project.brief.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    {project.brief.prospect_nom ?? "Brief"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <a
                    href={`/api/briefs/${project.brief.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-[var(--border)] px-2 py-0.5"
                    title="Télécharger le brief en PDF"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </a>
                </div>
              </InfoRow>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
              Calendrier
            </h2>
            <InfoRow icon={Calendar} label="Début">
              <InlinePicker
                variant="date"
                value={project.start_date}
                onSave={patch("start_date")}
                ariaLabel="Date de début"
                displayAs={(v) => (
                  <span className="text-sm text-foreground font-mono">
                    {formatDate(v)}
                  </span>
                )}
              />
            </InfoRow>
            <InfoRow icon={Calendar} label="Fin prévue">
              <InlinePicker
                variant="date"
                value={project.end_date}
                onSave={patch("end_date")}
                ariaLabel="Date de fin"
                displayAs={(v) => (
                  <span className="text-sm text-foreground font-mono">
                    {formatDate(v)}
                  </span>
                )}
              />
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
        <Card className="p-4">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Notes
          </h2>
          <InlineText
            value={project.description}
            onSave={patch("description")}
            ariaLabel="Description"
            variant="textarea"
            placeholder="Ajouter une description…"
            displayClassName="text-sm whitespace-pre-wrap"
            rows={5}
          />
        </Card>

        {/* Tâches du projet */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{ background: projectColor }}
                aria-hidden
              />
              <ListChecks className="h-3 w-3" />
              Tâches du projet ({tasks.filter((t) => t.status !== "cancelled").length})
            </h2>
            <Button size="sm" variant="outline" onClick={openTaskCreate}>
              <Plus className="h-3.5 w-3.5" />
              Nouvelle tâche
            </Button>
          </div>

          {tasks.filter((t) => t.status !== "cancelled").length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Aucune tâche pour ce projet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {tasks
                .filter((t) => t.status !== "cancelled")
                .map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onToggle={toggleTaskDone}
                    onEdit={openTaskEdit}
                  />
                ))}
            </ul>
          )}
        </Card>

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

              <div className="flex items-center justify-end gap-3 md:gap-6 pt-2 border-t border-[var(--border)] text-xs flex-wrap">
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
        contacts={contacts}
        companies={companies}
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

      <TaskDrawer
        open={taskOpen}
        onOpenChange={setTaskOpen}
        task={editingTask}
        defaultRelated={{ type: "project", id: project.id }}
        members={profiles.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email ?? null,
        }))}
        onSuccess={handleSuccess}
      />
    </>
  );
}

// ============================================================
// Sub-component : ligne de tâche (compact)
// ============================================================
const TASK_PRIO_META: Record<
  TaskPriority,
  { label: string; color: string; Icon: React.ComponentType<{ className?: string }> | null }
> = {
  low: { label: "Basse", color: "text-muted-foreground", Icon: null },
  normal: { label: "Normale", color: "text-foreground", Icon: null },
  high: { label: "Haute", color: "text-[#FB923C]", Icon: AlertCircle },
  urgent: { label: "Urgente", color: "text-destructive", Icon: Flame },
};

function TaskItem({
  task,
  onToggle,
  onEdit,
}: {
  task: ProjectTaskRow;
  onToggle: (t: ProjectTaskRow) => void;
  onEdit: (t: ProjectTaskRow) => void;
}) {
  const done = task.status === "done";
  const overdue =
    !!task.due_date &&
    task.due_date < new Date().toISOString().slice(0, 10) &&
    !done;
  const prio = TASK_PRIO_META[task.priority];

  return (
    <li className="flex items-start gap-3 py-2.5">
      <button
        onClick={() => onToggle(task)}
        className="mt-0.5 shrink-0"
        aria-label={done ? "Rouvrir" : "Marquer terminée"}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex-1 min-w-0 text-left"
      >
        <p
          className={cn(
            "text-sm font-medium text-foreground hover:text-accent transition-colors",
            done && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                overdue ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Clock className="h-3 w-3" />
              {formatDate(task.due_date)}
            </span>
          )}
          {task.priority !== "normal" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                prio.color
              )}
            >
              {prio.Icon && <prio.Icon className="h-3 w-3" />}
              {prio.label}
            </span>
          )}
          {task.assignee?.full_name && (
            <span className="text-[11px] text-muted-foreground">
              👤 {task.assignee.full_name}
            </span>
          )}
        </div>
      </button>
    </li>
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
