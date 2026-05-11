"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFieldDefinition } from "@/lib/actions/custom-fields";
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldType,
} from "@/types";

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Sélection",
  url: "URL",
  boolean: "Oui / Non",
};

interface Props {
  entityType: CustomFieldEntityType;
  onAdded: (field: CustomFieldDefinition) => void;
  onCancel: () => void;
}

export function AddFieldForm({ entityType, onAdded, onCancel }: Props) {
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nom requis.");
      return;
    }

    const options =
      fieldType === "select"
        ? optionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (fieldType === "select" && (!options || options.length < 2)) {
      setError("Ajoutez au moins 2 options séparées par des virgules.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createFieldDefinition({
        entity_type: entityType,
        name: name.trim(),
        field_type: fieldType,
        options,
        required,
      });
      if (result.success) {
        setName("");
        setOptionsRaw("");
        setRequired(false);
        setFieldType("text");
        onAdded(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-accent/20 bg-[var(--muted)]/20 p-4 space-y-3"
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
        Nouveau champ
      </p>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Nom du champ
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex : Source, SIRET, Budget max…"
          autoFocus
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Type
        </label>
        <Select
          value={fieldType}
          onValueChange={(v) => setFieldType(v as CustomFieldType)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(FIELD_TYPE_LABELS) as [CustomFieldType, string][]).map(
              ([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {fieldType === "select" && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Options{" "}
            <span className="normal-case text-muted-foreground/60">
              (séparées par des virgules)
            </span>
          </label>
          <Input
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            placeholder="Option A, Option B, Option C"
            className="h-8 text-xs"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="accent-accent"
        />
        Champ obligatoire
      </label>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="h-7 text-xs"
        >
          {pending ? "Création…" : "Créer le champ"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
