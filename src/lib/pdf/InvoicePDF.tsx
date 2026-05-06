import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

interface InvoicePDFProps {
  invoice: {
    number: string;
    type: "quote" | "invoice";
    issue_date: string;
    due_date: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes: string | null;
    contact: { first_name: string; last_name: string } | null;
    company: { name: string } | null;
    items: {
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }[];
  };
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: "#0B1220",
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandSquare: {
    width: 22,
    height: 22,
    backgroundColor: "#3B7BF5",
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 5,
    marginRight: 8,
  },
  brandName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 8, color: "#6B7280" },
  docMeta: { textAlign: "right" },
  docKind: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docNumber: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  partyBlock: { width: "48%" },
  partyLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyLine: { fontSize: 9, marginBottom: 1 },
  partyName: { fontFamily: "Helvetica-Bold" },
  partyMuted: { color: "#6B7280" },
  datesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    marginBottom: 16,
  },
  dateBlock: { width: "48%" },
  dateLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  dateValue: { fontSize: 9 },
  table: { marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderColor: "#0B1220",
    paddingVertical: 6,
  },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
  },
  cellDescription: { width: "55%", paddingRight: 6 },
  cellQty: { width: "10%", textAlign: "center" },
  cellPrice: { width: "17%", textAlign: "right" },
  cellTotal: { width: "18%", textAlign: "right" },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 200,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLabel: { color: "#6B7280" },
  totalValue: {},
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#0B1220",
    paddingTop: 6,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  notes: {
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  notesLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  notesText: { fontSize: 9 },
  legal: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 7,
    color: "#6B7280",
    lineHeight: 1.5,
  },
});

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const isQuote = invoice.type === "quote";

  return (
    <Document
      title={`${isQuote ? "Devis" : "Facture"} ${invoice.number}`}
      author="norva. — Agence Prime"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandSquare}>N</Text>
            <View>
              <Text style={styles.brandName}>norva.</Text>
              <Text style={styles.brandSub}>Agence Prime</Text>
            </View>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docKind}>{isQuote ? "Devis" : "Facture"}</Text>
            <Text style={styles.docNumber}>{invoice.number}</Text>
          </View>
        </View>

        {/* Sender / Receiver */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Émetteur</Text>
            <Text style={[styles.partyLine, styles.partyName]}>
              norva. — Agence Prime
            </Text>
            <Text style={[styles.partyLine, styles.partyMuted]}>
              SIRET : XXX XXX XXX 00001
            </Text>
            <Text style={[styles.partyLine, styles.partyMuted]}>
              contact@agence-prime.fr
            </Text>
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Client</Text>
            {invoice.company && (
              <Text style={[styles.partyLine, styles.partyName]}>
                {invoice.company.name}
              </Text>
            )}
            {invoice.contact && (
              <Text style={[styles.partyLine, styles.partyMuted]}>
                {invoice.contact.first_name} {invoice.contact.last_name}
              </Text>
            )}
            {!invoice.company && !invoice.contact && (
              <Text style={[styles.partyLine, styles.partyMuted]}>—</Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Date d&apos;émission</Text>
            <Text style={styles.dateValue}>
              {formatDate(invoice.issue_date)}
            </Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Échéance</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.due_date)}</Text>
          </View>
        </View>

        {/* Lines */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.cellDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderText, styles.cellQty]}>Qté</Text>
            <Text style={[styles.tableHeaderText, styles.cellPrice]}>
              P.U. HT
            </Text>
            <Text style={[styles.tableHeaderText, styles.cellTotal]}>
              Total HT
            </Text>
          </View>

          {invoice.items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cellDescription, { color: "#6B7280" }]}>
                Aucune ligne
              </Text>
            </View>
          ) : (
            invoice.items.map((item, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={styles.cellDescription}>{item.description}</Text>
                <Text style={styles.cellQty}>{item.quantity}</Text>
                <Text style={styles.cellPrice}>
                  {formatEUR(item.unit_price)}
                </Text>
                <Text style={styles.cellTotal}>{formatEUR(item.total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>{formatEUR(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({invoice.tax_rate}%)</Text>
            <Text style={styles.totalValue}>
              {formatEUR(invoice.tax_amount)}
            </Text>
          </View>
          <View style={styles.totalGrand}>
            <Text>Total TTC</Text>
            <Text>{formatEUR(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Mentions légales */}
        <View style={styles.legal}>
          <Text>
            {isQuote
              ? "Devis valable 30 jours. À retourner signé avec mention « Bon pour accord »."
              : "TVA non applicable, art. 293 B du CGI (à adapter selon régime). En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal s'appliqueront, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €."}
          </Text>
          <Text style={{ marginTop: 4 }}>norva. — Agence Prime</Text>
        </View>
      </Page>
    </Document>
  );
}
