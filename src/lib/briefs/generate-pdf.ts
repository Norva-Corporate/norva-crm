import "server-only";

import { htmlToPdfBuffer } from "@/lib/pdf/launch-browser";
import {
  BRIEF_SECTIONS,
  groupReponsesBySections,
  labelForOption,
  KPI_LABELS,
  type BriefSection,
  type GroupedField,
} from "@/lib/briefs/sections";

export interface BriefForPdf {
  id: string;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  submitted_at: string;
  reponses: Record<string, unknown>;
}

// ── HTML helpers ────────────────────────────────────────────
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasFields(v: unknown, keys: readonly string[]): boolean {
  if (!isRecord(v)) return false;
  return keys.some((k) => typeof v[k] === "string");
}

const URL_ENTRY_KEYS = ["url", "note"] as const;
const CONTACT_ENTRY_KEYS = ["nom", "role_entreprise", "role_projet", "email"] as const;

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderValueHtml(value: unknown, fieldKey?: string): string {
  if (value === null || value === undefined || value === "") {
    return `<span class="muted-italic">—</span>`;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return escapeHtml(String(value)).replace(/\n/g, "<br/>");
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<span class="muted-italic">—</span>`;
    }

    // Array de strings → tags
    if (value.every((v) => typeof v === "string")) {
      const tags = (value as string[]).map((v) => {
        const label = fieldKey ? labelForOption(fieldKey, v) : v;
        return `<span class="tag">${escapeHtml(label)}</span>`;
      });
      return `<div class="tag-list">${tags.join("")}</div>`;
    }

    // Array URL {url, note}
    if (value.every((v) => hasFields(v, URL_ENTRY_KEYS))) {
      const entries = value as { url?: string; note?: string }[];
      const filled = entries.filter((e) => e.url?.trim() || e.note?.trim());
      if (filled.length === 0) {
        return `<span class="muted-italic">—</span>`;
      }
      return `<ul class="url-list">${filled
        .map(
          (e, i) => `
            <li>
              <span class="url-num">${String(i + 1).padStart(2, "0")}</span>
              <div>
                ${e.url ? `<span class="url-href">${escapeHtml(e.url)}</span>` : ""}
                ${e.note ? `<p class="url-note">${escapeHtml(e.note)}</p>` : ""}
              </div>
            </li>
          `
        )
        .join("")}</ul>`;
    }

    // Array Contact
    if (value.every((v) => hasFields(v, CONTACT_ENTRY_KEYS))) {
      const entries = value as {
        nom?: string;
        role_entreprise?: string;
        role_projet?: string;
        email?: string;
      }[];
      const filled = entries.filter(
        (e) => e.nom?.trim() || e.email?.trim() || e.role_entreprise?.trim()
      );
      if (filled.length === 0) {
        return `<span class="muted-italic">—</span>`;
      }
      return `
        <table class="contacts-tbl">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle entreprise</th>
              <th>Rôle projet</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${filled
              .map(
                (e) => `
                  <tr>
                    <td>${escapeHtml(e.nom ?? "—")}</td>
                    <td>${escapeHtml(e.role_entreprise ?? "—")}</td>
                    <td>${escapeHtml(e.role_projet ?? "—")}</td>
                    <td>${escapeHtml(e.email ?? "—")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }
  }

  // Objet KPI
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== "" && v != null);
    if (entries.length === 0) {
      return `<span class="muted-italic">—</span>`;
    }
    return `<dl class="kpi-list">${entries
      .map(
        ([k, v]) => `
          <div class="kpi-row">
            <dt>${escapeHtml(KPI_LABELS[k] ?? humanizeKey(k))}</dt>
            <dd>${escapeHtml(String(v))}</dd>
          </div>
        `
      )
      .join("")}</dl>`;
  }

  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderFieldHtml(field: GroupedField): string {
  return `
    <div class="field">
      <div class="field-label">${escapeHtml(field.label)}</div>
      <div class="field-value">${renderValueHtml(field.value, field.key)}</div>
    </div>
  `;
}

// ── Section page builder ────────────────────────────────────
function renderSectionPage(
  section: BriefSection,
  fields: GroupedField[],
  pageIndex: number,
  totalSections: number
): string {
  // Split label "01. Entreprise & Positionnement" → "01" + "Entreprise & Positionnement"
  const [num, ...rest] = section.label.split(". ");
  const title = rest.join(". ");

  return `
    <section class="section-page">
      <header class="section-header">
        <span class="section-num">${escapeHtml(num)}</span>
        <h2 class="section-title">${escapeHtml(title)}</h2>
      </header>
      <div class="section-fields">
        ${fields.map(renderFieldHtml).join("")}
      </div>
      <footer class="section-footer">
        <span>norva<span class="dot">.</span> · Brief client</span>
        <span class="page-counter">Section ${String(pageIndex).padStart(2, "0")} / ${String(totalSections).padStart(2, "0")}</span>
      </footer>
    </section>
  `;
}

function buildHtml(brief: BriefForPdf): string {
  const submittedDate = new Date(brief.submitted_at).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const grouped = groupReponsesBySections(brief.reponses);

  // Toutes les 10 sections sont rendues (même si vides) pour traçabilité
  // → on parcourt BRIEF_SECTIONS, et on prend les fields trouvés (ou liste vide)
  const sectionsHtml = BRIEF_SECTIONS.map((section, idx) => {
    const found = grouped.sections.find(
      (s) => s.section.id === section.id
    );
    const fields = found?.fields ?? [];
    return renderSectionPage(section, fields, idx + 1, BRIEF_SECTIONS.length);
  }).join("");

  const orphansHtml =
    grouped.orphans.length > 0
      ? `
        <section class="section-page">
          <header class="section-header">
            <span class="section-num section-num--gray">+</span>
            <h2 class="section-title">Champs additionnels</h2>
          </header>
          <div class="section-fields">
            ${grouped.orphans.map(renderFieldHtml).join("")}
          </div>
          <footer class="section-footer">
            <span>norva<span class="dot">.</span> · Brief client</span>
            <span class="page-counter">Annexe</span>
          </footer>
        </section>
      `
      : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Brief — ${escapeHtml(brief.prospect_nom ?? "Prospect")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --midnight: #0B1220;
    --signal:   #3B7BF5;
    --ice:      #F2F4F8;
    --gray:     #6B7280;
    --mist:     #8A99B8;
    --border:   #E5E7EB;
    --border-strong: #DDE1EA;
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
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  @page {
    size: A4;
    margin: 0;
  }

  /* ══════════════════════════════════════════════════════════
     COVER (page 1 — page de garde)
     ════════════════════════════════════════════════════════ */
  .cover {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .cover-top {
    background: var(--midnight);
    color: #FFFFFF;
    padding: 28mm 22mm 22mm;
    position: relative;
    flex-shrink: 0;
  }
  .cover-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--signal);
  }
  .cover-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24mm;
  }
  .cover-brand-mark {
    width: 28px;
    height: 28px;
    background: var(--signal);
    color: #FFFFFF;
    font-family: "DM Sans", sans-serif;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover-brand-name {
    font-family: "DM Sans", sans-serif;
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .cover-brand-name .dot { color: var(--signal); }
  .cover-eyebrow {
    font-family: "DM Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--signal);
    margin-bottom: 8mm;
  }
  .cover-title {
    font-family: "DM Sans", sans-serif;
    font-size: 38px;
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0 0 4mm;
  }
  .cover-subtitle {
    font-family: "DM Sans", sans-serif;
    font-size: 14px;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
  }
  .cover-bottom {
    flex: 1;
    padding: 14mm 22mm 22mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cover-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8mm 12mm;
  }
  .meta-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gray);
    margin-bottom: 2mm;
  }
  .meta-value {
    font-size: 12px;
    color: var(--midnight);
    font-weight: 500;
    word-break: break-word;
  }
  .cover-footer {
    padding-top: 8mm;
    border-top: 1px solid var(--border-strong);
    display: flex;
    justify-content: space-between;
    font-family: "DM Mono", monospace;
    font-size: 9px;
    color: var(--gray);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .cover-footer .dot { color: var(--signal); }

  /* ══════════════════════════════════════════════════════════
     SECTION PAGES (1 page = 1 section)
     ════════════════════════════════════════════════════════ */
  .section-page {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    break-after: page;
    padding: 18mm 22mm;
    display: flex;
    flex-direction: column;
    background: #FFFFFF;
  }
  .section-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    gap: 12mm;
    border-bottom: 1px solid var(--border-strong);
    padding-bottom: 6mm;
    margin-bottom: 8mm;
  }
  .section-num {
    font-family: "DM Mono", monospace;
    font-size: 32px;
    font-weight: 500;
    color: var(--signal);
    letter-spacing: -0.02em;
    line-height: 1;
    flex-shrink: 0;
  }
  .section-num--gray {
    color: var(--gray);
  }
  .section-title {
    font-family: "DM Sans", sans-serif;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0;
    padding-top: 2mm;
    color: var(--midnight);
  }

  .section-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5mm;
    overflow: hidden;
  }
  .field {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .field-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gray);
    margin-bottom: 2mm;
  }
  .field-value {
    font-size: 11px;
    color: var(--midnight);
    line-height: 1.55;
    background: var(--ice);
    border: 1px solid var(--border);
    padding: 3mm 4mm;
  }
  .muted-italic {
    color: var(--mist);
    font-style: italic;
  }

  /* ── Section footer (numéro de page) ── */
  .section-footer {
    margin-top: 6mm;
    padding-top: 4mm;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    font-family: "DM Mono", monospace;
    font-size: 9px;
    color: var(--gray);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .section-footer .dot { color: var(--signal); }
  .page-counter {
    font-weight: 500;
  }

  /* ══════════════════════════════════════════════════════════
     COMPLEX VALUE RENDERS
     ════════════════════════════════════════════════════════ */
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .tag {
    display: inline-block;
    font-size: 10px;
    padding: 3px 9px;
    background: rgba(59, 123, 245, 0.08);
    color: var(--signal);
    border: 1px solid rgba(59, 123, 245, 0.25);
  }
  .url-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .url-list li {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 8px;
    align-items: start;
  }
  .url-num {
    font-family: "DM Mono", monospace;
    font-size: 10px;
    color: var(--signal);
    font-weight: 500;
  }
  .url-href {
    display: block;
    color: var(--midnight);
    word-break: break-all;
    font-size: 10.5px;
  }
  .url-note {
    color: var(--gray);
    font-size: 10px;
    margin: 1px 0 0;
  }

  .contacts-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  .contacts-tbl th {
    text-align: left;
    font-family: "DM Mono", monospace;
    font-size: 8.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gray);
    padding: 5px 6px;
    border-bottom: 1px solid var(--border-strong);
    font-weight: 500;
  }
  .contacts-tbl td {
    padding: 5px 6px;
    border-bottom: 1px solid var(--border);
    color: var(--midnight);
    vertical-align: top;
    word-break: break-word;
  }

  .kpi-list {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
  }
  .kpi-row {
    display: flex;
    gap: 6px;
    font-size: 10.5px;
    align-items: baseline;
  }
  .kpi-row dt {
    color: var(--gray);
    margin: 0;
    flex-shrink: 0;
  }
  .kpi-row dd {
    color: var(--midnight);
    margin: 0;
    font-weight: 500;
  }
</style>
</head>
<body>
  <!-- ══════════ COVER ══════════ -->
  <div class="cover">
    <!-- Bloc haut sombre -->
    <div class="cover-top">
      <div class="cover-bar"></div>
      <div class="cover-brand">
        <div class="cover-brand-mark">N</div>
        <span class="cover-brand-name">norva<span class="dot">.</span></span>
      </div>
      <div class="cover-eyebrow">Brief client</div>
      <h1 class="cover-title">${escapeHtml(brief.prospect_nom ?? "Prospect")}</h1>
      <p class="cover-subtitle">Document fondateur du projet</p>
    </div>

    <!-- Bloc bas clair -->
    <div class="cover-bottom">
      <div class="cover-meta">
        ${
          brief.prospect_entreprise
            ? `
              <div>
                <div class="meta-label">Entreprise</div>
                <div class="meta-value">${escapeHtml(brief.prospect_entreprise)}</div>
              </div>
            `
            : ""
        }
        ${
          brief.prospect_email
            ? `
              <div>
                <div class="meta-label">Email</div>
                <div class="meta-value">${escapeHtml(brief.prospect_email)}</div>
              </div>
            `
            : ""
        }
        <div>
          <div class="meta-label">Date de soumission</div>
          <div class="meta-value">${escapeHtml(submittedDate)}</div>
        </div>
        <div>
          <div class="meta-label">Référence</div>
          <div class="meta-value">${escapeHtml(brief.id.slice(0, 8).toUpperCase())}</div>
        </div>
      </div>
      <div class="cover-footer">
        <span>norva<span class="dot">.</span> · norva-corporate.fr</span>
        <span>Confidentiel</span>
      </div>
    </div>
  </div>

  <!-- ══════════ SECTIONS (une par page) ══════════ -->
  ${sectionsHtml}
  ${orphansHtml}
</body>
</html>`;
}

// ── Public API ──────────────────────────────────────────────
export async function generateBriefPdf(brief: BriefForPdf): Promise<Buffer> {
  console.log("[briefs/pdf] start generation for", brief.id);
  const html = buildHtml(brief);
  return htmlToPdfBuffer(html, "briefs/pdf");
}

export function briefPdfFilename(brief: BriefForPdf): string {
  const safeName = (brief.prospect_nom ?? "brief")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "brief";
  return `Brief-${safeName}-${brief.id.slice(0, 8)}.pdf`;
}

export function briefPdfStoragePath(briefId: string): string {
  return `briefs/${briefId}.pdf`;
}

export const BRIEF_SECTION_COUNT = BRIEF_SECTIONS.length;
