"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Send,
  CheckCircle2,
  Download,
  Ban,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { InvoiceDrawer } from "@/components/facturation/InvoiceDrawer";
import {
  updateInvoiceStatus,
  convertQuoteToInvoice,
} from "@/lib/actions/invoices";
import {
  formatCurrency,
  formatDate,
  cn,
  getEffectiveInvoiceStatus,
} from "@/lib/utils";
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  DocumentType,
} from "@/types";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  brouillon: {
    label: "Brouillon",
    bg: "rgba(138,153,184,0.1)",
    text: "#8A99B8",
    border: "rgba(138,153,184,0.3)",
  },
  envoyee: {
    label: "Envoyée",
    bg: "rgba(59,123,245,0.1)",
    text: "#3B7BF5",
    border: "rgba(59,123,245,0.3)",
  },
  payee: {
    label: "Payée",
    bg: "rgba(34,197,94,0.1)",
    text: "#22C55E",
    border: "rgba(34,197,94,0.3)",
  },
  en_retard: {
    label: "En retard",
    bg: "rgba(239,68,68,0.1)",
    text: "#EF4444",
    border: "rgba(239,68,68,0.3)",
  },
  annulee: {
    label: "Annulée",
    bg: "rgba(138,153,184,0.05)",
    text: "rgba(138,153,184,0.6)",
    border: "rgba(138,153,184,0.2)",
  },
};

type InvoiceDetail = Invoice & {
  project: { id: string; name: string } | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  company: { id: string; name: string } | null;
  items: InvoiceItem[];
};

interface Props {
  invoice: InvoiceDetail;
  projects: { id: string; name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
}

export function InvoiceDetailClient({
  invoice,
  projects,
  contacts,
  companies,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const effectiveStatus = getEffectiveInvoiceStatus(invoice);
  const sc = STATUS_CONFIG[effectiveStatus];
  const isQuote = invoice.type === "quote";
  const docLabel: Record<DocumentType, string> = {
    invoice: "Facture",
    quote: "Devis",
  };

  function changeStatus(status: InvoiceStatus) {
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoice.id, status);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoice.id, "annulee");
      if (!res.success) {
        setError(res.error);
        return;
      }
      setCancelOpen(false);
      router.refresh();
    });
  }

  function handleDownloadPdf() {
    const url = `/api/invoices/${invoice.id}/pdf`;
    window.open(url, "_blank");
  }

  function handleConvert() {
    setError(null);
    startTransition(async () => {
      const res = await convertQuoteToInvoice(invoice.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setConvertOpen(false);
      router.push(`/dashboard/facturation/${res.data.id}`);
    });
  }

  return (
    <>
      {/* Document layout — light background overrides the dark dashboard */}
      <div className="invoice-document flex-1 bg-[#F2F4F8] text-[#0B1220] p-6 md:p-10 pb-32">
        <div className="max-w-[720px] mx-auto space-y-6">
          {/* Top nav (hidden on print) */}
          <Link
            href="/dashboard/facturation"
            className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#0B1220] transition-colors no-print"
          >
            <ArrowLeft className="h-3 w-3" />
            Toutes les factures
          </Link>

          {/* Document */}
          <div className="bg-white border border-[#E5E7EB] p-8 md:p-10 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-[#3B7BF5] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">N</span>
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight">
                    norva.
                  </p>
                  <p className="text-[10px] text-[#6B7280]">
                    Agence Prime
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
                  {docLabel[invoice.type]}
                </p>
                <p className="text-sm font-mono font-semibold">{invoice.number}</p>
                <span
                  className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5"
                  style={{
                    backgroundColor: sc.bg,
                    color: sc.text,
                    border: `1px solid ${sc.border}`,
                  }}
                >
                  {sc.label}
                </span>
              </div>
            </div>

            {/* Sender / Receiver */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">
                  Émetteur
                </p>
                <p className="font-medium">norva. — Agence Prime</p>
                <p className="text-[#6B7280]">SIRET : XXX XXX XXX 00001</p>
                <p className="text-[#6B7280]">contact@agence-prime.fr</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">
                  Client
                </p>
                {invoice.company && (
                  <p className="font-medium">{invoice.company.name}</p>
                )}
                {invoice.contact && (
                  <p className="text-[#6B7280]">
                    {invoice.contact.first_name} {invoice.contact.last_name}
                  </p>
                )}
                {!invoice.company && !invoice.contact && (
                  <p className="text-[#6B7280]">—</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-6 text-xs border-y border-[#E5E7EB] py-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
                  Date d'émission
                </p>
                <p className="font-mono">{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">
                  Échéance
                </p>
                <p className="font-mono">{formatDate(invoice.due_date)}</p>
              </div>
            </div>

            {/* Lines */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-[#0B1220]">
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-center py-2 font-medium w-16">Qté</th>
                    <th className="text-right py-2 font-medium w-24">P.U. HT</th>
                    <th className="text-right py-2 font-medium w-24">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[#6B7280]">
                        Aucune ligne
                      </td>
                    </tr>
                  ) : (
                    invoice.items.map((item) => (
                      <tr key={item.id} className="border-b border-[#E5E7EB]">
                        <td className="py-2.5">{item.description}</td>
                        <td className="py-2.5 text-center font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Sous-total HT</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">
                      TVA ({invoice.tax_rate}%)
                    </span>
                    <span className="font-mono">
                      {formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#0B1220] pt-1.5 font-bold">
                    <span>Total TTC</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="text-xs border-t border-[#E5E7EB] pt-4">
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">
                  Notes
                </p>
                <p className="text-[#0B1220] whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}

            {/* Mentions légales (placeholder) */}
            <div className="text-[10px] text-[#6B7280] border-t border-[#E5E7EB] pt-4 leading-relaxed">
              <p>
                {isQuote
                  ? "Devis valable 30 jours. À retourner signé avec mention « Bon pour accord »."
                  : "TVA non applicable, art. 293 B du CGI (à adapter selon régime). En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal s'appliqueront, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €."}
              </p>
              <p className="mt-1">norva. — Agence Prime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating bottom action bar (hidden on print) */}
      <div
        className={cn(
          "no-print fixed bottom-0 left-56 right-0 z-30",
          "bg-[var(--card)] border-t border-[var(--border)]",
          "px-6 py-3 flex items-center gap-2 flex-wrap"
        )}
      >
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1 rounded-sm">
            {error}
          </p>
        )}

        {invoice.status === "brouillon" && (
          <Button
            size="sm"
            onClick={() => changeStatus("envoyee")}
            disabled={pending}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Send className="h-3.5 w-3.5" />
            Marquer envoyée
          </Button>
        )}

        {!isQuote &&
          (effectiveStatus === "envoyee" ||
            effectiveStatus === "en_retard") && (
            <Button
              size="sm"
              onClick={() => changeStatus("payee")}
              disabled={pending}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <CheckCircle2 className="h-3.5 w-3.5" />
              Marquer payée
            </Button>
          )}

        {isQuote && invoice.status !== "annulee" && (
          <Button
            size="sm"
            onClick={() => setConvertOpen(true)}
            disabled={pending}
          >
            <FileText className="h-3.5 w-3.5" />
            Convertir en facture
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
          <Download className="h-3.5 w-3.5" />
          Télécharger PDF
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditOpen(true)}
          disabled={pending}
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </Button>

        {invoice.status !== "annulee" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCancelOpen(true)}
            disabled={pending}
            className="ml-auto text-destructive hover:text-destructive"
          >
            <Ban className="h-3.5 w-3.5" />
            {isQuote ? "Annuler le devis" : "Annuler la facture"}
          </Button>
        )}
      </div>

      <InvoiceDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        invoice={invoice}
        projects={projects}
        contacts={contacts}
        companies={companies}
        onSuccess={() => router.refresh()}
      />

      <Dialog
        open={convertOpen}
        onOpenChange={(o) => !pending && setConvertOpen(o)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convertir en facture</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-2">
            <p className="text-sm text-foreground">
              Le devis{" "}
              <span className="font-mono font-medium">{invoice.number}</span>{" "}
              sera cloné en facture (statut Brouillon, échéance dans 30 jours).
            </p>
            <p className="text-xs text-muted-foreground">
              Le devis original reste inchangé. Tu pourras éditer la facture
              avant de l'envoyer.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertOpen(false)}
              disabled={pending}
            >
              Retour
            </Button>
            <Button onClick={handleConvert} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Convertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={(o) => !pending && setCancelOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Annuler la facture</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-2">
            <p className="text-sm text-foreground">
              La facture{" "}
              <span className="font-mono font-medium">{invoice.number}</span>{" "}
              sera marquée annulée.
            </p>
            <p className="text-xs text-muted-foreground">
              Elle restera visible dans l'historique mais ne sera plus comptabilisée
              dans les totaux.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={pending}
            >
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          aside,
          header {
            display: none !important;
          }
          .invoice-document {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
