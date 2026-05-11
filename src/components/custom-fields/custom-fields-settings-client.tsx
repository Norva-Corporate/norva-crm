"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddFieldForm } from "@/components/custom-fields/add-field-form";
import { deleteFieldDefinition } from "@/lib/actions/custom-fields";
import { cn } from "@/lib/utils";
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldType,
} from "@/types";

interface Props {
  contact: CustomFieldDefinition[];
  company: CustomFieldDefinition[];
  deal: CustomFieldDefinition[];
  project: CustomFieldDefinition[];
  lead_import: CustomFieldDefinition[];
}

const SECTION_LABELS: Record<CustomFieldEntityType, string> = {
  contact: "Contacts",
  company: "Entreprises",
  deal: "Deals",
  project: "Projets",
  lead_import: "Leads",
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Sélection",
  url: "URL",
  boolean: "Oui / Non",
};

export function CustomFieldsSettingsClient({
  contact,
  company,
  deal,
  project,
  lead_import,
}: Props) {
  const initial: Record<CustomFieldEntityType, CustomFieldDefinition[]> = {
    contact,
    company,
    deal,
    project,
    lead_import,
  };
  const [fieldsByType, setFieldsByType] = useState(initial);

  React.useEffect(() => {
    setFieldsByType(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, company, deal, project, lead_import]);

  function updateSection(
    type: CustomFieldEntityType,
    updater: (prev: CustomFieldDefinition[]) => CustomFieldDefinition[]
  ) {
    setFieldsByType((prev) => ({ ...prev, [type]: updater(prev[type]) }));
  }

  return (
    <div className="flex-1 p-6 animate-fade-in space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">
          Champs personnalisés
        </h1>
        <p className="text-xs text-muted-foreground">
          Créez des champs spécifiques à votre activité pour chaque module.
          Les champs apparaissent automatiquement sur toutes les fiches.
        </p>
      </div>

      {(Object.keys(SECTION_LABELS) as CustomFieldEntityType[]).map((type) => (
        <Section
          key={type}
          entityType={type}
          fields={fieldsByType[type]}
          onAdded={(field) =>
            updateSection(type, (prev) => [...prev, field])
          }
          onDeleted={(id) =>
            updateSection(type, (prev) => prev.filter((f) => f.id !== id))
          }
        />
      ))}
    </div>
  );
}

function Section({
  entityType,
  fields,
  onAdded,
  onDeleted,
}: {
  entityType: CustomFieldEntityType;
  fields: CustomFieldDefinition[];
  onAdded: (field: CustomFieldDefinition) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete(field: CustomFieldDefinition) {
    if (
      !confirm(
        `Supprimer le champ "${field.name}" ?\n\nLes valeurs de ce champ sur toutes les fiches ${SECTION_LABELS[entityType]} seront perdues.`
      )
    ) {
      return;
    }
    onDeleted(field.id);
    startTransition(async () => {
      const result = await deleteFieldDefinition(field.id);
      if (!result.success) {
        toast.error(result.error, { id: `cf-${field.id}` });
        router.refresh();
      } else {
        toast.success(`Champ "${field.name}" supprimé.`, {
          id: `cf-${field.id}`,
        });
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {SECTION_LABELS[entityType]}
          </h2>
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-mono">
            {fields.length} champ{fields.length > 1 ? "s" : ""}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
          className="h-7 gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          {showAdd ? "Annuler" : "Ajouter un champ"}
        </Button>
      </div>

      {showAdd && (
        <AddFieldForm
          entityType={entityType}
          onAdded={(field) => {
            onAdded(field);
            setShowAdd(false);
            startTransition(() => router.refresh());
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {fields.length === 0 && !showAdd ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          Aucun champ personnalisé.
        </p>
      ) : (
        <ul className="space-y-1">
          {fields.map((field) => (
            <li
              key={field.id}
              className={cn(
                "group/row flex items-center gap-3 px-2 py-2",
                "border border-[var(--border)] bg-[var(--surface)]",
                "hover:border-accent/40 transition-colors"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm text-foreground font-medium">
                    {field.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </span>
                  {field.required && (
                    <span className="text-[10px] text-destructive">
                      obligatoire
                    </span>
                  )}
                </div>
                {field.field_type === "select" && field.options && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    Options : {field.options.join(", ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(field)}
                aria-label={`Supprimer le champ ${field.name}`}
                className={cn(
                  "h-6 w-6 flex items-center justify-center rounded-sm shrink-0",
                  "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10",
                  "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
                  "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                )}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
