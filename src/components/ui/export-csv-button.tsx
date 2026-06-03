"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { buildCsv, csvFilename, downloadCsv, type CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface Props<T> {
  rows: T[];
  columns: CsvColumn<T>[];
  /** Préfixe du nom de fichier (ex : "contacts", "deals"). Date auto-ajoutée. */
  filenamePrefix: string;
  /** Label du bouton (default : "Exporter CSV"). */
  label?: string;
  className?: string;
}

export function ExportCsvButton<T>({
  rows,
  columns,
  filenamePrefix,
  label = "Exporter",
  className,
}: Props<T>) {
  function handleExport() {
    if (rows.length === 0) {
      toast.info("Aucune ligne à exporter.");
      return;
    }
    try {
      const csv = buildCsv(rows, columns);
      downloadCsv(csv, csvFilename(filenamePrefix));
      toast.success(`${rows.length} ligne${rows.length > 1 ? "s" : ""} exportée${rows.length > 1 ? "s" : ""}.`);
    } catch (err) {
      console.error("[export-csv]", err);
      toast.error("Export échoué.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      title={`Exporter ${rows.length} ligne${rows.length > 1 ? "s" : ""} en CSV`}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 text-xs border border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground hover:border-[var(--muted)] transition-colors",
        className
      )}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
