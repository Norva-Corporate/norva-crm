"use client";
import React, { useEffect, useState, useTransition } from "react";
import {
  ResponsiveDrawer,
  ResponsiveDrawerHeader as DrawerHeader,
  ResponsiveDrawerBody as DrawerBody,
  ResponsiveDrawerFooter as DrawerFooter,
  ResponsiveDrawerTitle as DrawerTitle,
  ResponsiveDrawerDescription as DrawerDescription,
} from "@/components/ui/responsive-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  createProject,
  updateProject,
  type ProjectInput,
} from "@/lib/actions/projects";
import { DriveFolderButton } from "@/components/integrations/drive-folder-button";
import { projectStatuses } from "@/lib/statuses";
import type { Project, ProjectStatus } from "@/types";

const NO_VALUE = "__none__";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  en_attente: projectStatuses.en_attente.label,
  en_cours: projectStatuses.en_cours.label,
  en_pause: projectStatuses.en_pause.label,
  termine: projectStatuses.termine.label,
  annule: projectStatuses.annule.label,
};

interface ProjectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  deals: { id: string; title: string }[];
  profiles: { id: string; full_name: string | null }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  defaultDealId?: string;
  onSuccess?: (id?: string) => void;
}

interface FormState {
  name: string;
  description: string;
  status: ProjectStatus;
  deal_id: string;
  contact_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  budget: string;
  duration_days: string;
  assigned_to: string;
}

const empty: FormState = {
  name: "",
  description: "",
  status: "en_attente",
  deal_id: "",
  contact_id: "",
  company_id: "",
  start_date: "",
  end_date: "",
  budget: "",
  duration_days: "14",
  assigned_to: "",
};

export function ProjectDrawer({
  open,
  onOpenChange,
  project,
  deals,
  profiles,
  contacts,
  companies,
  defaultDealId,
  onSuccess,
}: ProjectDrawerProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!project;

  useEffect(() => {
    if (open) {
      setError(null);
      if (project) {
        setForm({
          name: project.name,
          description: project.description ?? "",
          status: project.status,
          deal_id: project.deal_id ?? "",
          contact_id: project.contact_id ?? "",
          company_id: project.company_id ?? "",
          start_date: project.start_date ?? "",
          end_date: project.end_date ?? "",
          budget: project.budget != null ? String(project.budget) : "",
          duration_days:
            project.duration_days != null ? String(project.duration_days) : "14",
          assigned_to: project.assigned_to ?? "",
        });
      } else {
        setForm({ ...empty, deal_id: defaultDealId ?? "" });
      }
    }
  }, [open, project, defaultDealId]);

  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedDuration = form.duration_days
      ? parseInt(form.duration_days, 10)
      : 14;
    const payload: ProjectInput = {
      name: form.name,
      description: form.description || null,
      status: form.status,
      deal_id: form.deal_id || null,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      duration_days:
        Number.isFinite(parsedDuration) && parsedDuration > 0
          ? parsedDuration
          : 14,
      assigned_to: form.assigned_to || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateProject(project!.id, payload)
        : await createProject(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.(
        isEdit ? undefined : (result.data as { id: string } | null)?.id
      );
    });
  }

  const canSubmit = form.name.trim().length > 0;

  return (
    <ResponsiveDrawer open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Modifier le projet" : "Nouveau projet"}
            </DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Mettez à jour les informations du projet."
                : "Créez un nouveau projet et liez-le à un deal."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom du projet *</Label>
                <Input
                  value={form.name}
                  onChange={field("name")}
                  placeholder="Refonte site web"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={field("description")}
                  placeholder="Notes internes, périmètre…"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as ProjectStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(STATUS_LABELS) as ProjectStatus[]
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Budget (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.budget}
                    onChange={field("budget")}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Durée (jours)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={form.duration_days}
                    onChange={field("duration_days")}
                    placeholder="14"
                    title="Durée prévue du delivery — module les délais des tâches auto (1-180j, par défaut 14)"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Deal lié</Label>
                <Select
                  value={form.deal_id || NO_VALUE}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      deal_id: v === NO_VALUE ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un deal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>
                      <span className="text-muted-foreground">Aucun</span>
                    </SelectItem>
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Select
                    value={form.contact_id || NO_VALUE}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        contact_id: v === NO_VALUE ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>
                        <span className="text-muted-foreground">Aucun</span>
                      </SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entreprise</Label>
                  <Select
                    value={form.company_id || NO_VALUE}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        company_id: v === NO_VALUE ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une entreprise" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>
                        <span className="text-muted-foreground">Aucune</span>
                      </SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Select
                  value={form.assigned_to || NO_VALUE}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      assigned_to: v === NO_VALUE ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un membre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>
                      <span className="text-muted-foreground">Non assigné</span>
                    </SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={field("start_date")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date de fin prévue</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={field("end_date")}
                  />
                </div>
              </div>

              {isEdit && project?.id && (
                <div className="space-y-1.5">
                  <Label>Documents</Label>
                  <DriveFolderButton
                    kind="project"
                    id={project.id}
                    initialUrl={project.drive_folder_url ?? null}
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer le projet"}
            </Button>
          </DrawerFooter>
        </form>
    </ResponsiveDrawer>
  );
}
