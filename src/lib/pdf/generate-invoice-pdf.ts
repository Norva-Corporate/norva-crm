import "server-only";

import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export interface InvoiceForPdf {
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
}

const VAT_REGIME =
  "TVA non applicable, art. 293 B du CGI (à adapter selon votre régime).";

// ── Helpers ─────────────────────────────────────────────────
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

// ── HTML template ───────────────────────────────────────────
function buildHtml(invoice: InvoiceForPdf): string {
  const isQuote = invoice.type === "quote";
  const docTitle = isQuote ? "Devis" : "Facture";

  const clientName = invoice.company?.name?.trim() ?? "";
  const clientContact = invoice.contact
    ? `${invoice.contact.first_name} ${invoice.contact.last_name}`.trim()
    : "";

  const itemsRows = invoice.items.length === 0
    ? `<tr><td colspan="4" class="empty">Aucune ligne</td></tr>`
    : invoice.items
        .map(
          (item) => `
            <tr>
              <td class="desc">${escapeHtml(item.description ?? "")}</td>
              <td class="qty">${item.quantity}</td>
              <td class="price">${escapeHtml(formatEUR(item.unit_price))}</td>
              <td class="total">${escapeHtml(formatEUR(item.total))}</td>
            </tr>
          `
        )
        .join("");

  const legalText = isQuote
    ? "Devis valable 30 jours. À retourner signé avec mention « Bon pour accord »."
    : `${VAT_REGIME} En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal s'appliqueront, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(docTitle)} ${escapeHtml(invoice.number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --midnight: #0B1220;
    --signal:   #3B7BF5;
    --ice:      #F2F4F8;
    --gray:     #6B7280;
    --border:   #E5E7EB;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    color: var(--midnight);
    font-family: "DM Sans", "Helvetica Neue", system-ui, sans-serif;
    font-weight: 400;
    font-size: 11px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  @page {
    size: A4;
    margin: 16mm 16mm;
  }
  .doc {
    max-width: 100%;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 16px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-square {
    width: 26px;
    height: 26px;
    background: var(--signal);
    color: #FFFFFF;
    font-weight: 600;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .brand-name {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-size: 10px;
    color: var(--gray);
    margin-top: 1px;
  }
  .doc-meta {
    text-align: right;
  }
  .doc-kind {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gray);
  }
  .doc-number {
    font-family: "DM Mono", monospace;
    font-size: 13px;
    font-weight: 500;
    margin-top: 2px;
  }

  /* ── Parties (Émetteur / Client) ── */
  .parties {
    display: flex;
    gap: 24px;
    margin-bottom: 18px;
  }
  .party {
    flex: 1;
  }
  .party-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gray);
    margin-bottom: 6px;
  }
  .party-name {
    font-weight: 600;
    font-size: 11px;
    margin-bottom: 1px;
  }
  .party-muted {
    color: var(--gray);
    font-size: 10.5px;
    margin-bottom: 1px;
  }

  /* ── Dates ── */
  .dates {
    display: flex;
    gap: 24px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-bottom: 18px;
  }
  .date-block {
    flex: 1;
  }
  .date-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gray);
    margin-bottom: 3px;
  }
  .date-value {
    font-family: "DM Mono", monospace;
    font-size: 10.5px;
  }

  /* ── Table ── */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  table.items thead tr {
    border-bottom: 1.5px solid var(--midnight);
  }
  table.items th {
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    padding: 6px 4px;
  }
  table.items tbody tr {
    border-bottom: 1px solid var(--border);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table.items td {
    padding: 8px 4px;
    font-size: 10.5px;
    vertical-align: top;
  }
  table.items td.desc { width: 55%; padding-right: 8px; }
  table.items td.qty { width: 10%; text-align: center; font-family: "DM Mono", monospace; }
  table.items td.price { width: 17%; text-align: right; font-family: "DM Mono", monospace; }
  table.items td.total { width: 18%; text-align: right; font-family: "DM Mono", monospace; }
  table.items th.qty { text-align: center; }
  table.items th.price, table.items th.total { text-align: right; }
  table.items td.empty {
    text-align: center;
    color: var(--gray);
    font-style: italic;
    padding: 16px 4px;
  }

  /* ── Totals ── */
  .totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 18px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .totals-box {
    min-width: 240px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 10.5px;
  }
  .total-row .label { color: var(--gray); }
  .total-row .value { font-family: "DM Mono", monospace; }
  .total-grand {
    display: flex;
    justify-content: space-between;
    border-top: 1.5px solid var(--midnight);
    padding-top: 6px;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
  }
  .total-grand .value { font-family: "DM Mono", monospace; }

  /* ── Notes ── */
  .notes {
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .notes-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gray);
    margin-bottom: 4px;
  }
  .notes-text {
    font-size: 10.5px;
    white-space: pre-wrap;
  }

  /* ── Legal ── */
  .legal {
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 18px;
    font-size: 9px;
    color: var(--gray);
    line-height: 1.5;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .legal .signature {
    margin-top: 4px;
  }
</style>
</head>
<body>
  <div class="doc">
    <!-- Header -->
    <div class="header">
      <div class="brand">
        <div class="brand-square">N</div>
        <div>
          <div class="brand-name">norva.</div>
          <div class="brand-sub">norva-corporate.fr</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-kind">${escapeHtml(docTitle)}</div>
        <div class="doc-number">${escapeHtml(invoice.number)}</div>
      </div>
    </div>

    <!-- Émetteur / Client -->
    <div class="parties">
      <div class="party">
        <div class="party-label">Émetteur</div>
        <div class="party-name">norva.</div>
        <div class="party-muted">norvagroupe@gmail.com</div>
        <div class="party-muted">norva-corporate.fr</div>
      </div>
      <div class="party">
        <div class="party-label">Client</div>
        ${clientName ? `<div class="party-name">${escapeHtml(clientName)}</div>` : ""}
        ${clientContact ? `<div class="party-muted">${escapeHtml(clientContact)}</div>` : ""}
        ${!clientName && !clientContact ? `<div class="party-muted">—</div>` : ""}
      </div>
    </div>

    <!-- Dates -->
    <div class="dates">
      <div class="date-block">
        <div class="date-label">Date d'émission</div>
        <div class="date-value">${escapeHtml(formatDate(invoice.issue_date))}</div>
      </div>
      <div class="date-block">
        <div class="date-label">${isQuote ? "Validité" : "Échéance"}</div>
        <div class="date-value">${escapeHtml(formatDate(invoice.due_date))}</div>
      </div>
    </div>

    <!-- Items -->
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="qty">Qté</th>
          <th class="price">P.U. HT</th>
          <th class="total">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span class="label">Sous-total HT</span>
          <span class="value">${escapeHtml(formatEUR(invoice.subtotal))}</span>
        </div>
        <div class="total-row">
          <span class="label">TVA (${invoice.tax_rate}%)</span>
          <span class="value">${escapeHtml(formatEUR(invoice.tax_amount))}</span>
        </div>
        <div class="total-grand">
          <span>Total TTC</span>
          <span class="value">${escapeHtml(formatEUR(invoice.total))}</span>
        </div>
      </div>
    </div>

    ${
      invoice.notes
        ? `
          <div class="notes">
            <div class="notes-label">Notes</div>
            <div class="notes-text">${escapeHtml(invoice.notes)}</div>
          </div>
        `
        : ""
    }

    <!-- Mentions légales -->
    <div class="legal">
      <div>${escapeHtml(legalText)}</div>
      <div class="signature">norva. · norvagroupe@gmail.com</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Browser bootstrap (même pattern que generate-brief-pdf.ts) ──
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

async function launchBrowser(): Promise<Browser> {
  const local = process.env.LOCAL_CHROMIUM_PATH;
  if (local) {
    console.log("[invoices/pdf] launching local chromium:", local);
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  console.log(
    "[invoices/pdf] resolving @sparticuz/chromium from:",
    CHROMIUM_PACK_URL
  );
  const execPath = await chromium.executablePath(CHROMIUM_PACK_URL);
  return puppeteer.launch({
    args: chromium.args,
    executablePath: execPath,
    headless: true,
  });
}

// ── Public API ──────────────────────────────────────────────
export async function generateInvoicePdf(
  invoice: InvoiceForPdf
): Promise<Buffer> {
  console.log(
    `[invoices/pdf] start generation for ${invoice.type} ${invoice.number}`
  );
  const html = buildHtml(invoice);

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(
      `[invoices/pdf] rendered ${invoice.number}, bytes=${pdf.length}`
    );
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function invoicePdfFilename(invoice: InvoiceForPdf): string {
  const kind = invoice.type === "quote" ? "Devis" : "Facture";
  const safeNumber = invoice.number.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${kind}-${safeNumber}.pdf`;
}
