"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { TaskTemplateDrawer } from "./TaskTemplateDrawer";
import {
  deleteTaskTemplate,
  type TaskTemplate,
} from "@/lib/actions/task-templates";

const SCOPE_LABEL: Record<string, string> = {
  global: "Global",
  deal: "Deal",
  project: "Projet",
};

export function TaskTemplatesClient({
  initialTemplates,
}: {
  initialTemplates: TaskTemplate[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(tpl: TaskTemplate) {
    setEditing(tpl);
    setDrawerOpen(true);
  }

  function handleDeleted() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteTaskTemplate(deleting.id).then((res) => {
      if (res.success) {
        toast.success("Template supprimé.");
        startTransition(() => router.refresh());
      } else {
        toast.error(res.error);
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
        title="Templates de tâches"
        action={{ label: "Nouveau template", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in">
        <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
          Les templates permettent de créer une liste de tâches d'un seul
          clic depuis un deal ou un projet. Chaque tâche peut avoir un
          décalage en jours par rapport à la date d'application (ex: J+0
          "Envoyer brief", J+3 "Relance brief").
        </p>

        {initialTemplates.length === 0 ? (
          <Card className="px-4 py-16 text-center text-sm text-muted-foreground">
            <ListChecks className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="mb-2">Aucun template pour l'instant.</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Créer le premier
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {initialTemplates.map((tpl) => (
              <Card key={tpl.id} className="p-3">
                <div className="flex items-start gap-3">
                  <ListChecks className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">
                        {tpl.name}
                      </p>
                      <Badge variant="default" className="text-[10px]">
                        {SCOPE_LABEL[tpl.scope] ?? tpl.scope}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {tpl.items.length} tâche
                        {tpl.items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                  <RowActions
                    onEdit={() => openEdit(tpl)}
                    onDelete={() => setDeleting(tpl)}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskTemplateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        template={editing}
        onSuccess={handleSuccess}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="le template"
        itemName={deleting?.name ?? ""}
        onConfirm={handleDeleted}
      />
    </>
  );
}
