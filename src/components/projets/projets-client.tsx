"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDrawer } from "@/components/projets/ProjectDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { deleteProject } from "@/lib/actions/projects";
import { formatDate, cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive"; progress: number; color: string }
> = {
  en_attente: { label: "En attente", variant: "secondary", progress: 0, color: "#8A99B8" },
  en_cours: { label: "En cours", variant: "default", progress: 50, color: "#3B7BF5" },
  en_pause: { label: "En pause", variant: "warning", progress: 50, color: "#F59E0B" },
  termine: { label: "Terminé", variant: "success", progress: 100, color: "#22C55E" },
  annule: { label: "Annulé", variant: "destructive", progress: 0, color: "#EF4444" },
};

const FILTERS: { key: "all" | ProjectStatus; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "en_attente", label: "En attente" },
  { key: "en_cours", label: "En cours" },
  { key: "en_pause", label: "En pause" },
  { key: "termine", label: "Terminé" },
  { key: "annule", label: "Annulé" },
];

type ProjectRow = Project & {
  deal: {
    id: string;
    title: string;
    contact?: { id: string; first_name: string; last_name: string } | null;
    company?: { id: string; name: string } | null;
  } | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  company: { id: string; name: string } | null;
  assignee: { id: string; full_name: string | null } | null;
};

interface Props {
  initialProjects: ProjectRow[];
  deals: { id: string; title: string }[];
  profiles: { id: string; full_name: string | null }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
}

export function ProjetsClient({
  initialProjects,
  deals,
  profiles,
  contacts,
  companies,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<ProjectRow | null>(null);
  const [, startTransition] = useTransition();

  const today = useMemo(() => new Date(), []);
  const startOfMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );

  const stats = useMemo(() => {
    const actifs = initialProjects.filter(
      (p) =>
        p.status === "en_attente" ||
        p.status === "en_cours" ||
        p.status === "en_pause"
    ).length;
    const enCours = initialProjects.filter((p) => p.status === "en_cours").length;
    const terminesMois = initialProjects.filter(
      (p) =>
        p.status === "termine" && new Date(p.updated_at) >= startOfMonth
    ).length;
    const enRetard = initialProjects.filter((p) => {
      if (!p.end_date) return false;
      if (p.status === "termine" || p.status === "annule") return false;
      return new Date(p.end_date) < today;
    }).length;
    return { actifs, enCours, terminesMois, enRetard };
  }, [initialProjects, today, startOfMonth]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialProjects.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.deal?.title?.toLowerCase().includes(q) ||
        p.deal?.company?.name?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialProjects, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(project: ProjectRow) {
    setEditing(project);
    setDrawerOpen(true);
  }

  function handleDelete() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteProject(deleting.id).then((res) => {
      if (res.success) {
        startTransition(() => router.refresh());
      }
      return res;
    });
  }

  function handleSuccess() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Header
        title="Projets"
        action={{ label: "Nouveau projet", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Projets actifs" value={stats.actifs} />
          <KPI label="En cours" value={stats.enCours} accent="#3B7BF5" />
          <KPI label="Terminés ce mois" value={stats.terminesMois} accent="#22C55E" />
          <KPI label="En retard" value={stats.enRetard} accent="#EF4444" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors rounded-sm",
                  statusFilter === f.key
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} projet{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Mobile : liste de cartes */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
              Aucun projet.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">
                Créer le premier
              </button>
            </Card>
          ) : (
            filtered.map((project) => {
              const sc = STATUS_CONFIG[project.status];
              const contact = project.contact ?? project.deal?.contact;
              const company = project.company ?? project.deal?.company;
              return (
                <Card
                  key={project.id}
                  onClick={() => router.push(`/dashboard/projets/${project.id}`)}
                  className="p-3 cursor-pointer hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {project.name}
                        </p>
                        <Badge variant={sc.variant} className="shrink-0 text-[10px]">
                          {sc.label}
                        </Badge>
                      </div>
                      <div className="space-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        {(contact || company) && (
                          <p className="truncate">
                            {contact
                              ? `${contact.first_name} ${contact.last_name}`
                              : ""}
                            {contact && company ? " · " : ""}
                            {company?.name ?? ""}
                          </p>
                        )}
                        {project.deal?.title && (
                          <p className="truncate">Deal : {project.deal.title}</p>
                        )}
                        {project.assignee?.full_name && (
                          <p className="truncate">
                            Owner : {project.assignee.full_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {project.end_date
                            ? `→ ${formatDate(project.end_date)}`
                            : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-16 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${sc.progress}%`,
                                backgroundColor: sc.color,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {sc.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
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
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop : tableau */}
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <Th>Nom</Th>
                  <Th>Client</Th>
                  <Th>Deal</Th>
                  <Th>Owner</Th>
                  <Th>Statut</Th>
                  <Th>Début</Th>
                  <Th>Fin</Th>
                  <Th>Avancement</Th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      Aucun projet.{" "}
                      <button
                        onClick={openCreate}
                        className="text-accent hover:underline"
                      >
                        Créer le premier
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((project) => {
                    const sc = STATUS_CONFIG[project.status];
                    const contact = project.contact ?? project.deal?.contact;
                    const company = project.company ?? project.deal?.company;
                    return (
                      <tr
                        key={project.id}
                        onClick={() =>
                          router.push(`/dashboard/projets/${project.id}`)
                        }
                        className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">
                            {project.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {contact ? (
                              <p className="text-foreground">
                                {contact.first_name} {contact.last_name}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">—</p>
                            )}
                            {company && (
                              <p className="text-muted-foreground truncate max-w-[160px]">
                                {company.name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground truncate block max-w-[200px]">
                            {project.deal?.title ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {project.assignee?.full_name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(project.start_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(project.end_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ProgressBar value={sc.progress} color={sc.color} />
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(project)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleting(project)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ProjectDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        project={editing}
        deals={deals}
        profiles={profiles}
        contacts={contacts}
        companies={companies}
        onSuccess={handleSuccess}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="le projet"
        itemName={deleting?.name ?? ""}
        description="Les factures liées ne seront pas supprimées mais perdront leur référence projet."
        onConfirm={handleDelete}
      />
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
      {children}
    </th>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className="text-2xl font-bold font-mono"
        style={accent ? { color: accent } : { color: "var(--foreground)" }}
      >
        {value}
      </p>
    </Card>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
        {value}%
      </span>
    </div>
  );
}
