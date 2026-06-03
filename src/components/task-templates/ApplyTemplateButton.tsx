"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyTaskTemplate,
  listTaskTemplates,
  type TaskTemplate,
  type TaskTemplateScope,
} from "@/lib/actions/task-templates";

/**
 * Bouton "Appliquer un template" intégré dans DealDrawer / ProjectDrawer.
 * Charge la liste des templates (scope global + scope ciblé) au moment
 * de l'ouverture du modal pour éviter une requête au mount du drawer.
 *
 * UX :
 * - Click → modal avec dropdown (sélection template) + preview des tâches
 *   du template choisi (titre + J+N + priorité).
 * - "Créer les N tâches" → applyTaskTemplate → toast "X tâches créées"
 *   → router.refresh() pour que la liste des tâches du drawer se rafraîchisse.
 */
export function ApplyTemplateButton({
  scope,
  relatedId,
  variant = "outline",
  size = "sm",
  className,
}: {
  scope: Extract<TaskTemplateScope, "deal" | "project">;
  relatedId: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTaskTemplates(scope)
      .then((list) => {
        setTemplates(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, [open, scope]);

  const selected = templates.find((t) => t.id === selectedId);

  function handleApply() {
    if (!selected) return;
    startTransition(async () => {
      const res = await applyTaskTemplate(selected.id, {
        related_type: scope,
        related_id: relatedId,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { created, failed } = res.data;
      if (failed > 0) {
        toast.warning(
          `${created} tâche${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""} · ${failed} échec${failed > 1 ? "s" : ""}`
        );
      } else {
        toast.success(
          `${created} tâche${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}.`
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Appliquer un template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer un template de tâches</DialogTitle>
            <DialogDescription>
              Sélectionne un template — toutes ses tâches seront créées
              automatiquement avec leur date relative.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun template disponible.{" "}
              <Link
                href="/dashboard/settings/task-templates"
                className="text-accent hover:underline"
              >
                En créer un
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.items.length} tâche
                      {t.items.length > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selected && (
                <div className="border border-[var(--border)] bg-[var(--surface)] p-3 max-h-60 overflow-y-auto">
                  {selected.description && (
                    <p className="text-[11px] text-muted-foreground mb-2 italic">
                      {selected.description}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {selected.items.map((it, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="text-muted-foreground font-mono w-10 shrink-0">
                          J+{it.due_offset_days}
                        </span>
                        <span className="flex-1 truncate text-foreground">
                          {it.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {it.priority}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleApply}
              disabled={pending || !selected || templates.length === 0}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Créer{selected ? ` ${selected.items.length} tâche${selected.items.length > 1 ? "s" : ""}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
