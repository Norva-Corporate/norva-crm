"use client";
import React from "react";

/**
 * Helpers partagés pour les tableaux de listing (contacts, companies,
 * projets, factures, etc.). Réutiliser ces composants plutôt que de
 * redéfinir un `<Th>` local dans chaque fichier client.
 */

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
      ? "text-center"
      : "text-left";
  return (
    <th
      className={
        `px-4 py-2.5 text-xs font-medium text-muted-foreground ${alignClass}` +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </th>
  );
}

/**
 * Ligne d'en-tête de tableau prédéfinie : applique le bg/border attendu.
 * Usage : <TableHeadRow>{children}</TableHeadRow>
 */
export function TableHeadRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
      {children}
    </tr>
  );
}

/**
 * Cellule "vide" pour le cas `paginated.length === 0`.
 * Étire sur N colonnes et affiche un message + CTA de création.
 */
export function EmptyTableRow({
  colSpan,
  icon: Icon,
  label,
  cta,
}: {
  colSpan: number;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-16 text-center text-sm text-muted-foreground"
      >
        {Icon && <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />}
        {label}
        {cta && (
          <>
            {" "}
            <button
              onClick={cta.onClick}
              className="text-accent hover:underline"
            >
              {cta.label}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
