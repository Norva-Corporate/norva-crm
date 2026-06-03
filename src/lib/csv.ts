/**
 * Helpers d'export CSV côté client. Format Excel-compatible (séparateur
 * virgule, BOM UTF-8 pour préserver les accents, guillemets pour échapper
 * les valeurs contenant `,` `"` `\n`).
 *
 * Usage :
 *   const csv = buildCsv(rows, [
 *     { header: "Nom", get: (r) => r.last_name },
 *     { header: "Email", get: (r) => r.email },
 *   ]);
 *   downloadCsv(csv, "leads-2026-06-02.csv");
 */

export interface CsvColumn<T> {
  header: string;
  get: (row: T) => string | number | null | undefined;
}

const BOM = "﻿"; // UTF-8 BOM pour Excel

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // RFC 4180 : entourer de " si la valeur contient , " ou \n ;
  // doubler les " internes.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((c) => escapeCell(c.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((c) => escapeCell(c.get(row))).join(",")
  );
  return BOM + [headerRow, ...dataRows].join("\n");
}

/** Déclenche le téléchargement d'un fichier CSV côté client. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Cleanup après un tick (Chrome a besoin du URL pendant le download)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Helper pratique : nom de fichier daté `prefix-YYYY-MM-DD.csv`. */
export function csvFilename(prefix: string): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${prefix}-${yyyy}-${mm}-${dd}.csv`;
}
