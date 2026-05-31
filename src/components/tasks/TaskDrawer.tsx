"use client";
import React, { useEffect, useState, useTransition } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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
import { createTask, updateTask, type TaskInput } from "@/lib/actions/tasks";
import { taskStatuses, taskPriorities } from "@/lib/statuses";
import type {
  Task,
  TaskPriority,
  TaskRelatedType,
  TaskStatus,
} from "@/types";

const NO_VALUE = "__none__";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: taskStatuses.pending.label,
  in_progress: taskStatuses.in_progress.label,
  done: taskStatuses.done.label,
  cancelled: taskStatuses.cancelled.label,
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: taskPriorities.low.label,
  normal: taskPriorities.normal.label,
  high: taskPriorities.high.label,
  urgent: taskPriorities.urgent.label,
};

interface TaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultRelated?: { type: TaskRelatedType; id: string } | null;
  members: { id: string; full_name: string | null; email: string | null }[];
  onSuccess?: (id?: string) => void;
}

export function TaskDrawer({
  open,
  onOpenChange,
  task,
  defaultRelated,
  members,
  onSuccess,
}: TaskDrawerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>(NO_VALUE);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ?? "");
      setAssignedTo(task.assigned_to ?? NO_VALUE);
    } else {
      setTitle("");
      setDescription("");
      setStatus("pending");
      setPriority("normal");
      setDueDate("");
      setAssignedTo(NO_VALUE);
    }
    setError(null);
  }, [open, task]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: TaskInput = {
      title,
      description: description || null,
      status,
      priority,
      due_date: dueDate || null,
      assigned_to: assignedTo === NO_VALUE ? null : assignedTo,
      related_type: task?.related_type ?? defaultRelated?.type ?? null,
      related_id: task?.related_id ?? defaultRelated?.id ?? null,
    };

    startTransition(async () => {
      const res = task
        ? await updateTask(task.id, payload)
        : await createTask(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess?.(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).data?.id
      );
      onOpenChange(false);
    });
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DrawerTitle>
            <DrawerDescription>
              {task ? `Modification de "${task.title}"` : "Crée une tâche libre ou liée à un contact, un deal, un projet."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Titre *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rappeler le client, préparer la proposition…"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Détails, contexte, prochaines étapes…"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(
                      (p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Échéance</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assigné à</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Personne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>Personne</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.email ?? m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                {error}
              </p>
            )}
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {task ? "Enregistrer" : "Créer"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
