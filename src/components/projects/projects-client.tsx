"use client";
import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Loader2, Pencil, Trash2, Calendar, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: any; color: string }> = {
  planning: { label: "Planification", variant: "secondary", color: "#8A99B8" },
  active: { label: "Actif", variant: "default", color: "#60A5FA" },
  on_hold: { label: "En pause", variant: "warning", color: "#FCD34D" },
  completed: { label: "Terminé", variant: "success", color: "#4ADE80" },
  cancelled: { label: "Annulé", variant: "destructive", color: "#F87171" },
};

interface ProjectForm {
  name: string;
  description: string;
  status: ProjectStatus;
  deal_id: string;
  start_date: string;
  end_date: string;
  budget: string;
  assigned_to: string;
}

const defaultForm: ProjectForm = {
  name: "",
  description: "",
  status: "planning",
  deal_id: "",
  start_date: "",
  end_date: "",
  budget: "",
  assigned_to: "",
};

interface Props {
  initialProjects: any[];
  deals: { id: string; title: string }[];
  profiles: { id: string; full_name: string | null }[];
}

export function ProjectsClient({ initialProjects, deals, profiles }: Props) {
  const [projects, setProjects] = useState<any[]>(initialProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ProjectForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const q = search.toLowerCase();
        const matchesSearch = !q || p.name.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [projects, search, statusFilter]
  );

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setIsOpen(true);
  }

  function openEdit(project: any) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      deal_id: project.deal_id ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      budget: project.budget?.toString() ?? "",
      assigned_to: project.assigned_to ?? "",
    });
    setIsOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const payload = {
      name: form.name,
      description: form.description || null,
      status: form.status,
      deal_id: form.deal_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      assigned_to: form.assigned_to || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", editing.id)
        .select("*, deal:deals(id, title), assignee:profiles(id, full_name)")
        .single();
      if (!error && data) setProjects((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...payload, created_by: user!.id })
        .select("*, deal:deals(id, title), assignee:profiles(id, full_name)")
        .single();
      if (!error && data) setProjects((prev) => [data, ...prev]);
    }

    setLoading(false);
    setIsOpen(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  return (
    <>
      <Header title="Projets" action={{ label: "Nouveau projet", onClick: openCreate }} />

      <div className="flex-1 p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1.5">
            {["all", "planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 transition-colors ${
                  statusFilter === s
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Tous" : STATUS_CONFIG[s as ProjectStatus]?.label ?? s}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} projet(s)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Aucun projet trouvé.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">Créer le premier</button>
            </div>
          ) : (
            filtered.map((project) => {
              const sc = STATUS_CONFIG[project.status as ProjectStatus];
              return (
                <Card key={project.id} className="p-4 hover:shadow-card-hover transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: sc.color }} />
                        <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
                      </div>
                      <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 shrink-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(project.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {project.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {project.deal && (
                      <p className="truncate">Deal : <span className="text-foreground">{project.deal.title}</span></p>
                    )}
                    {project.assignee && (
                      <p className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {project.assignee.full_name}
                      </p>
                    )}
                    {(project.start_date || project.end_date) && (
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.start_date ? formatDate(project.start_date) : "—"}
                        {project.end_date ? ` → ${formatDate(project.end_date)}` : ""}
                      </p>
                    )}
                    {project.budget && (
                      <p className="font-semibold text-foreground">{formatCurrency(project.budget)}</p>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Refonte site web"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Budget (€)</Label>
                <Input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="10000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deal lié</Label>
              <Select value={form.deal_id} onValueChange={(v) => setForm((f) => ({ ...f, deal_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non assigné</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading || !form.name}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer le projet</DialogTitle></DialogHeader>
          <p className="px-6 pb-2 text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
