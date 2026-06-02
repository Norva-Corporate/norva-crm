"use client";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pagination simple côté client pour les listes paginées (contacts,
 * companies, …). Affiche "Page X/Y — A-B sur N" + boutons prev/next.
 * Rien à afficher si `total <= pageSize` → le caller doit gate visuellement
 * (le composant retourne quand même null dans ce cas par sécurité).
 */
export function ListPagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-3 mt-2 border border-[var(--border)] bg-[var(--surface)]">
      <p className="text-[11px] md:text-xs text-muted-foreground">
        <span className="hidden sm:inline">Page </span>
        {page}/{totalPages}
        <span className="hidden sm:inline">
          {" "}— {start}-{end} sur {total}
        </span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
