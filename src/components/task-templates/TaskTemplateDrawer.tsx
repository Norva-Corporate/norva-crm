"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveDrawer,
  ResponsiveDrawerHeader as DrawerHeader,
  ResponsiveDrawerBody as DrawerBody,
  ResponsiveDrawerFooter as DrawerFooter,
  ResponsiveDrawerTitle as DrawerTitle,
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
import {
  createTaskTemplate,
  updateTaskTemplate,
  type TaskTemplate,
  type TaskTemplateItem,
  type TaskTemplateScope,
} from "@/lib/actions/task-templates";
import type { TaskPriority } from "@/types";

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

const EMPTY_ITEM: TaskTemplateItem = {
  title: "",
  description: null,
  priority: "normal",
  due_offset_days: 0,
};

export function TaskTemplateDrawer({
  open,
  onOpenChange,
  template,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TaskTemplate | null;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<TaskTemplateScope>("global");
  const [items, setItems] = useState<TaskTemplateItem[]>([EMPTY_ITEM]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setScope(template.scope);
      setItems(template.items.length > 0 ? template.items : [EMPTY_ITEM]);
    } else {
      setName("");
      setDescription("");
      setScope("global");
      setItems([EMPTY_ITEM]);
    }
  }, [open, template]);

  function updateItem(idx: number, patch: Partial<TaskTemplateItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    if (items.length === 0) {
      toast.error("Ajoute au moins une tâche.");
      return;
    }
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        scope,
        items,
      };
      const res = template
        ? await updateTaskTemplate(template.id, payload)
        : await createTaskTemplate(payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(template ? "Template modifié." : "Template créé.");
      onSuccess?.();
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[560px]"
    >
        <DrawerHeader>
          <DrawerTitle>
            {template ? "Modifier le template" : "Nouveau template"}
          </DrawerTitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="space-y-4">
            <div>
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex: "Onboarding client"'
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description (facultatif)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="À quoi sert ce template ?"
              />
            </div>

            <div>
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as TaskTemplateScope)}
              >
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    Global — visible partout
                  </SelectItem>
                  <SelectItem value="deal">Deal uniquement</SelectItem>
                  <SelectItem value="project">Projet uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Tâches</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 p-2 border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-6">
                        #{idx + 1}
                      </span>
                      <Input
                        value={it.title}
                        onChange={(e) =>
                          updateItem(idx, { title: e.target.value })
                        }
                        placeholder="Titre de la tâche"
                        className="flex-1 h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        title={
                          items.length === 1
                            ? "Au moins une tâche requise"
                            : "Supprimer cette tâche"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 pl-8">
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground">
                          J+
                        </Label>
                        <Input
                          type="number"
                          value={it.due_offset_days}
                          onChange={(e) =>
                            updateItem(idx, {
                              due_offset_days:
                                Number(e.target.value) || 0,
                            })
                          }
                          className="w-16 h-7 text-xs font-mono"
                        />
                      </div>
                      <Select
                        value={it.priority}
                        onValueChange={(v) =>
                          updateItem(idx, { priority: v as TaskPriority })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {template ? "Enregistrer" : "Créer"}
            </Button>
          </DrawerFooter>
        </form>
    </ResponsiveDrawer>
  );
}
