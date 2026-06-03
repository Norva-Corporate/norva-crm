"use client";
import React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dropdown "..." standardisé pour les listings : items Modifier + Supprimer.
 * Supporte des items custom (ex: Rejeter sur LeadCard) via la prop `extra`.
 */
export function RowActions({
  onEdit,
  onDelete,
  align = "end",
  stopPropagation = true,
  extra,
  disabled,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  align?: "start" | "center" | "end";
  /** Bloque la propagation du clic (utile dans une row cliquable). */
  stopPropagation?: boolean;
  /** Items supplémentaires rendus AVANT Modifier/Supprimer. */
  extra?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          disabled={disabled}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {extra}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
