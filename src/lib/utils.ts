import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InvoiceStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Promotes `envoyee` invoices past their due date to `en_retard`
// without mutating the underlying row. Mirrors the SQL view
// `invoices_with_effective_status` (migration 004).
export function getEffectiveInvoiceStatus(invoice: {
  status: InvoiceStatus | string;
  due_date: string | null | undefined;
}): InvoiceStatus {
  if (invoice.status === "envoyee" && invoice.due_date) {
    const due = new Date(`${invoice.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) return "en_retard";
  }
  return invoice.status as InvoiceStatus;
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeDate(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return formatDate(date);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
