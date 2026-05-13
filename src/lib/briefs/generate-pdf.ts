import "server-only";

import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import {
  BRIEF_SECTIONS,
  groupReponsesBySections,
  labelForOption,
  KPI_LABELS,
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

// ── HTML template (norva. brand) ────────────────────────────
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
    return `<span class="muted-italic">(vide)</span>`;
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
      return `<span class="muted-italic">(vide)</span>`;
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
        return `<span class="muted-italic">(vide)</span>`;
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

    // Array Contact {nom, role_entreprise, role_projet, email}
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
        return `<span class="muted-italic">(vide)</span>`;
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

  // Objet kpi-style
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== "" && v != null);
    if (entries.length === 0) {
      return `<span class="muted-italic">(vide)</span>`;
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

function buildHtml(brief: BriefForPdf): string {
  const submittedDate = new Date(brief.submitted_at).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const grouped = groupReponsesBySections(brief.reponses);

  const sectionsHtml = grouped.sections
    .map(
      (s) => `
        <section class="brief-section">
          <p class="section-tag">${escapeHtml(s.section.label.split(".")[0])}</p>
          <h2 class="section-title">${escapeHtml(
            s.section.label.split(". ").slice(1).join(". ")
          )}</h2>
          <div class="section-fields">
            ${s.fields.map(renderFieldHtml).join("")}
          </div>
        </section>
      `
    )
    .join("");

  const orphansHtml = grouped.orphans.length
    ? `
        <section class="brief-section">
          <p class="section-tag">Autres</p>
          <h2 class="section-title">Champs additionnels</h2>
          <div class="section-fields">
            ${grouped.orphans.map(renderFieldHtml).join("")}
          </div>
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
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  :root {
    --midnight: #0B1220;
    --navy: #1C2A44;
    --navy-deep: #0D1525;
    --signal: #3B7BF5;
    --ice: #F2F4F8;
    --mist: #8A99B8;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--midnight);
    color: var(--ice);
    font-family: "DM Sans", "Helvetica Neue", system-ui, sans-serif;
    font-weight: 400;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  /* Permet de garder le fond midnight même quand une page se déroule
     sur plusieurs pages PDF. Sans ça, les pages suivantes auraient un
     fond blanc/transparent qui casserait le look. */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: var(--midnight);
    z-index: -1;
  }
  @page {
    size: A4;
    margin: 14mm 14mm;
  }
  .page {
    padding: 0;
  }
  .accent-bar {
    width: 40px;
    height: 1px;
    background: var(--signal);
    margin-bottom: 20px;
  }
  .label-mono {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .label-blue {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--signal);
  }
  .header {
    margin-bottom: 32px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 10px 0 12px;
    color: var(--ice);
  }
  .header .meta {
    font-size: 10.5px;
    color: var(--mist);
    line-height: 1.6;
  }
  .header .meta strong {
    color: var(--ice);
    font-weight: 500;
  }
  .brief-section {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    padding-left: 18px;
    margin-bottom: 24px;
    position: relative;
  }
  .brief-section::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 0;
    width: 1px;
    height: 28px;
    background: var(--signal);
  }
  .section-tag {
    margin: 0 0 6px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .section-title {
    font-size: 15px;
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0 0 14px;
    color: var(--ice);
    page-break-after: avoid;
    break-after: avoid;
  }
  .section-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .field-label {
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--mist);
    margin-bottom: 5px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .field-value {
    font-size: 11px;
    color: var(--ice);
    line-height: 1.5;
    background: var(--navy-deep);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 10px 12px;
  }
  .field-value ul {
    margin: 0;
    padding-left: 18px;
  }
  .field-value pre {
    margin: 0;
    font-family: "DM Mono", monospace;
    font-size: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .muted-italic {
    color: var(--mist);
    font-style: italic;
  }
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    display: inline-block;
    font-size: 10.5px;
    padding: 3px 9px;
    background: rgba(59, 123, 245, 0.12);
    color: #99b8ff;
    border: 1px solid rgba(59, 123, 245, 0.25);
  }
  .url-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .url-list li {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 8px;
    align-items: start;
  }
  .url-num {
    font-family: "DM Mono", monospace;
    font-size: 10px;
    color: var(--signal);
  }
  .url-href {
    display: block;
    color: var(--ice);
    word-break: break-all;
    font-size: 11px;
  }
  .url-note {
    color: var(--mist);
    font-size: 10.5px;
    margin-top: 2px;
  }
  .contacts-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  .contacts-tbl th {
    text-align: left;
    font-family: "DM Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--mist);
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .contacts-tbl td {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--ice);
  }
  .kpi-list {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .kpi-row {
    display: flex;
    gap: 6px;
    font-size: 11px;
  }
  .kpi-row dt {
    color: var(--mist);
    margin: 0;
  }
  .kpi-row dd {
    color: var(--ice);
    margin: 0;
  }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: space-between;
    font-family: "DM Mono", monospace;
    font-size: 9px;
    color: var(--mist);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .brand {
    color: var(--ice);
    font-weight: 500;
  }
  .brand .dot { color: var(--signal); }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="accent-bar"></div>
      <p class="label-mono">Brief client</p>
      <h1>${escapeHtml(brief.prospect_nom ?? "Prospect")}</h1>
      <p class="meta">
        ${
          brief.prospect_entreprise
            ? `<strong>${escapeHtml(brief.prospect_entreprise)}</strong> · `
            : ""
        }${
          brief.prospect_email ? escapeHtml(brief.prospect_email) + " · " : ""
        }Soumis le ${escapeHtml(submittedDate)}
      </p>
    </header>

    ${sectionsHtml}
    ${orphansHtml}

    <footer class="footer">
      <span class="brand">norva<span class="dot">.</span></span>
      <span>${escapeHtml(submittedDate)}</span>
    </footer>
  </div>
</body>
</html>`;
}

// ── Browser bootstrap ───────────────────────────────────────
// Sur Vercel + Turbopack, outputFileTracingIncludes n'est pas honoré
// pour les fichiers binaires .br du dossier bin/ de @sparticuz/chromium.
// On utilise donc le mode "URL" : @sparticuz/chromium télécharge le
// tar.br depuis GitHub Releases au runtime quand executablePath() reçoit
// une URL. Le tar est extrait dans /tmp et le binary est utilisable.
// → cold start +3-5s la 1ère fois, instantané ensuite (lambda chaud +
//   cache PDF dans Supabase Storage).
//
// IMPORTANT: la version doit matcher la version installée de
// @sparticuz/chromium dans package.json (actuellement ^148.0.0).
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

async function launchBrowser(): Promise<Browser> {
  const local = process.env.LOCAL_CHROMIUM_PATH;
  if (local) {
    console.log("[briefs/pdf] launching local chromium:", local);
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  console.log(
    "[briefs/pdf] resolving @sparticuz/chromium from:",
    CHROMIUM_PACK_URL
  );
  const execPath = await chromium.executablePath(CHROMIUM_PACK_URL);
  console.log("[briefs/pdf] chromium ready at:", execPath);
  return puppeteer.launch({
    args: chromium.args,
    executablePath: execPath,
    headless: true,
  });
}

// ── Public API ──────────────────────────────────────────────
export async function generateBriefPdf(brief: BriefForPdf): Promise<Buffer> {
  console.log("[briefs/pdf] start generation for", brief.id);
  const html = buildHtml(brief);
  console.log("[briefs/pdf] html built, length:", html.length);

  const browser = await launchBrowser();
  console.log("[briefs/pdf] browser launched");

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    console.log("[briefs/pdf] content set");
    // Attendre que les fonts Google soient chargées avant le snapshot.
    await page.evaluate(() => document.fonts.ready);
    console.log("[briefs/pdf] fonts ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      // Les marges sont définies via @page dans le CSS pour permettre
      // une mise en page cohérente sur toutes les pages.
      preferCSSPageSize: true,
    });
    console.log("[briefs/pdf] pdf rendered, bytes:", pdf.length);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
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

// Helper exposé pour vérification de l'existence d'une référence
export const BRIEF_SECTION_COUNT = BRIEF_SECTIONS.length;
