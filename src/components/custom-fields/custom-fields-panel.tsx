"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineText } from "@/components/ui/inline-text";
import { InlinePicker } from "@/components/ui/inline-picker";
import { AddFieldForm } from "@/components/custom-fields/add-field-form";
import {
  deleteFieldDefinition,
  upsertFieldValue,
} from "@/lib/actions/custom-fields";
import { cn } from "@/lib/utils";
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldType,
  CustomFieldWithValue,
} from "@/types";

interface Props {
  entityType: CustomFieldEntityType;
  entityId: string;
  initialFields: CustomFieldWithValue[];
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Sélection",
  url: "URL",
  boolean: "Oui / Non",
};

const BOOL_OPTIONS = [
  { value: "true", label: "Oui" },
  { value: "false", label: "Non" },
];

export function CustomFieldsPanel({
  entityType,
  entityId,
  initialFields,
}: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<CustomFieldWithValue[]>(initialFields);
  const [showAddForm, setShowAddForm] = useState(false);
  const [, startTransition] = useTransition();

  // Sync from server when prop changes (after router.refresh())
  React.useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  function saveValue(fieldId: string) {
    return async (value: string | null) => {
      const result = await upsertFieldValue(
        fieldId,
        entityType,
        entityId,
        value
      );
      if (result.success) {
        startTransition(() => router.refresh());
      }
      return result;
    };
  }

  function handleDelete(fieldId: string, fieldName: string) {
    if (
      !confirm(
        `Supprimer le champ "${fieldName}" ?\n\nLes valeurs de ce champ sur toutes les fiches ${entityType} seront perdues.`
      )
    ) {
      return;
    }
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    startTransition(async () => {
      const result = await deleteFieldDefinition(fieldId);
      if (!result.success) {
        toast.error(result.error, { id: `cf-delete-${fieldId}` });
        // Revert by refreshing from server
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  function handleFieldAdded(field: CustomFieldDefinition) {
    setFields((prev) => [...prev, { ...field, value: null, value_id: null }]);
    setShowAddForm(false);
    startTransition(() => router.refresh());
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Champs personnalisés
          </h3>
          {fields.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-mono">
              {fields.length} champ{fields.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm((v) => !v)}
          className="h-7 gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          {showAddForm ? "Annuler" : "Ajouter un champ"}
        </Button>
      </div>

      {showAddForm && (
        <AddFieldForm
          entityType={entityType}
          onAdded={handleFieldAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {fields.length === 0 && !showAddForm ? (
        <div className="py-8 text-center">
          <p className="text-xs text-muted-foreground">
            Aucun champ personnalisé.
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Ajoutez des champs spécifiques à votre activité — source, SIRET, budget max…
          </p>
        </div>
      ) : (
        <dl className="space-y-2">
          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              onSave={saveValue(field.id)}
              onDelete={() => handleDelete(field.id, field.name)}
            />
          ))}
        </dl>
      )}
    </Card>
  );
}

function FieldRow({
  field,
  onSave,
  onDelete,
}: {
  field: CustomFieldWithValue;
  onSave: (
    v: string | null
  ) => Promise<{ success: true; data: null } | { success: false; error: string }>;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 group/row px-1 py-1 hover:bg-[var(--muted)]/20 transition-colors">
      <div className="flex-1 min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1.5">
          <span>{field.name}</span>
          <span className="text-muted-foreground/40 font-mono text-[9px] normal-case tracking-normal">
            {FIELD_TYPE_LABELS[field.field_type]}
          </span>
          {field.required && (
            <span className="text-destructive text-[9px]" aria-label="Obligatoire">
              *
            </span>
          )}
        </dt>
        <dd>
          <FieldControl field={field} onSave={onSave} />
        </dd>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Supprimer le champ ${field.name}`}
        className={cn(
          "h-5 w-5 shrink-0 flex items-center justify-center rounded-sm mt-0.5",
          "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10",
          "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
          "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
        )}
        title="Supprimer ce champ"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function FieldControl({
  field,
  onSave,
}: {
  field: CustomFieldWithValue;
  onSave: (
    v: string | null
  ) => Promise<{ success: true; data: null } | { success: false; error: string }>;
}) {
  const ariaLabel = field.name;

  switch (field.field_type) {
    case "select": {
      const options = (field.options ?? []).map((o) => ({
        value: o,
        label: o,
      }));
      return (
        <InlinePicker
          variant="select"
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          options={options}
          allowEmpty={!field.required}
          emptyLabel="—"
        />
      );
    }
    case "boolean":
      return (
        <InlinePicker
          variant="select"
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          options={BOOL_OPTIONS}
          allowEmpty={!field.required}
          emptyLabel="—"
          displayAs={(v) =>
            v === "true" ? (
              <span className="text-success">✓ Oui</span>
            ) : v === "false" ? (
              <span className="text-muted-foreground">✗ Non</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
      );
    case "date":
      return (
        <InlinePicker
          variant="date"
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          displayAs={(v) =>
            v ? (
              <span className="text-sm text-foreground font-mono">{v}</span>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )
          }
        />
      );
    case "url":
      return (
        <InlineText
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          variant="url"
          placeholder="https://…"
          required={field.required}
          displayAs={(v) => (
            <a
              href={v}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {v.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        />
      );
    case "number":
      return (
        <InlineText
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          variant="number"
          placeholder="0"
          required={field.required}
        />
      );
    case "text":
    default:
      return (
        <InlineText
          value={field.value}
          onSave={onSave}
          ariaLabel={ariaLabel}
          variant="text"
          placeholder="—"
          required={field.required}
        />
      );
  }
}

