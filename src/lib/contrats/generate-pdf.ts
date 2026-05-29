import "server-only";

import { htmlToPdfBuffer } from "@/lib/pdf/launch-browser";
import {
  buildSections,
  escapeHtml,
  type ContratClientSnapshot,
  type ContratOptions,
} from "@/lib/contrats/template";

export interface ContratForPdf {
  id: string;
  ref: string;
  created_at: string; // ISO
  client_snapshot: ContratClientSnapshot;
  options: ContratOptions;
  montant_total: number;
  acompte: number;
  solde: number;
}

export async function generateContratPdf(c: ContratForPdf): Promise<Buffer> {
  console.log("[contrats/pdf] start generation for", c.id);
  const html = buildHtml(c);
  return htmlToPdfBuffer(html, "contrats/pdf");
}

export function contratPdfFilename(c: Pick<ContratForPdf, "ref" | "id">): string {
  const safeRef = c.ref.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return `Contrat-${safeRef || c.id.slice(0, 8)}.pdf`;
}

export function contratPdfStoragePath(contratId: string): string {
  return `${contratId}/contrat.pdf`;
}

export function contratSignedPdfStoragePath(contratId: string): string {
  return `${contratId}/contrat-signe.pdf`;
}

export function contratProofStoragePath(contratId: string): string {
  return `${contratId}/dossier-preuve.pdf`;
}

// ── HTML builder ────────────────────────────────────────────
function buildHtml(c: ContratForPdf): string {
  const createdDate = new Date(c.created_at).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const sections = buildSections({
    client: c.client_snapshot,
    options: c.options,
    montant_total: c.montant_total,
    acompte: c.acompte,
    solde: c.solde,
  });

  const sectionsHtml = sections
    .map(
      (s, idx) => `
        <section class="section-page">
          <header class="section-header">
            <span class="section-num">${escapeHtml(s.num)}</span>
            <h2 class="section-title">${escapeHtml(s.title)}</h2>
          </header>
          <div class="section-body">${s.bodyHtml}</div>
          <footer class="section-footer">
            <span>norva<span class="dot">.</span> · Contrat ${escapeHtml(
              c.ref
            )}</span>
            <span class="page-counter">Article ${String(idx + 1).padStart(
              2,
              "0"
            )} / ${String(sections.length).padStart(2, "0")}</span>
          </footer>
        </section>
      `
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Contrat ${escapeHtml(c.ref)} — ${escapeHtml(
    c.client_snapshot.raison_sociale
  )}</title>
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
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  @page { size: A4; margin: 0; }

  /* ─── Cover ─── */
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
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--signal);
  }
  .cover-brand {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 24mm;
  }
  .cover-brand-mark {
    width: 28px; height: 28px;
    background: var(--signal); color: #fff;
    font-weight: 600; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .cover-brand-name { font-size: 17px; font-weight: 500; letter-spacing: -0.01em; }
  .cover-brand-name .dot { color: var(--signal); }
  .cover-eyebrow {
    font-family: "DM Mono", monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--signal); margin-bottom: 8mm;
  }
  .cover-title {
    font-size: 38px; font-weight: 500; letter-spacing: -0.03em;
    line-height: 1.05; margin: 0 0 4mm;
  }
  .cover-subtitle {
    font-size: 14px; font-weight: 300;
    color: rgba(255,255,255,0.7); margin: 0;
  }
  .cover-bottom {
    flex: 1;
    padding: 14mm 22mm 22mm;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .cover-meta {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8mm 12mm;
  }
  .meta-label {
    font-family: "DM Mono", monospace;
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--gray); margin-bottom: 2mm;
  }
  .meta-value {
    font-size: 12px; color: var(--midnight); font-weight: 500;
    word-break: break-word;
  }
  .cover-footer {
    padding-top: 8mm;
    border-top: 1px solid var(--border-strong);
    display: flex; justify-content: space-between;
    font-family: "DM Mono", monospace;
    font-size: 9px; color: var(--gray);
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .cover-footer .dot { color: var(--signal); }

  /* ─── Sections ─── */
  .section-page {
    width: 210mm; min-height: 297mm;
    page-break-after: always; break-after: page;
    padding: 18mm 22mm; display: flex; flex-direction: column;
    background: #fff;
  }
  .section-page:last-child {
    page-break-after: auto; break-after: auto;
  }
  .section-header {
    display: flex; align-items: flex-start; gap: 12mm;
    border-bottom: 1px solid var(--border-strong);
    padding-bottom: 6mm; margin-bottom: 8mm;
  }
  .section-num {
    font-family: "DM Mono", monospace;
    font-size: 32px; font-weight: 500;
    color: var(--signal); letter-spacing: -0.02em;
    line-height: 1; flex-shrink: 0;
  }
  .section-title {
    font-size: 22px; font-weight: 500; letter-spacing: -0.02em;
    line-height: 1.15; margin: 0; padding-top: 2mm;
    color: var(--midnight);
  }
  .section-body { flex: 1; }
  .section-body p { margin: 0 0 4mm; }
  .section-body strong { font-weight: 600; }
  .section-body .party { margin-left: 4mm; }
  .section-body .muted-italic { color: var(--mist); font-style: italic; }

  .scope { list-style: none; margin: 0; padding: 0; }
  .scope li {
    padding: 4mm 5mm;
    background: var(--ice);
    border: 1px solid var(--border);
    margin-bottom: 3mm;
  }
  .scope-title {
    display: block; font-weight: 600;
    color: var(--midnight); margin-bottom: 1.5mm; font-size: 12px;
  }
  .scope-desc {
    display: block; color: var(--gray); font-size: 10.5px; line-height: 1.5;
  }

  .fin-tbl {
    width: 100%; border-collapse: collapse; margin: 4mm 0 5mm;
  }
  .fin-tbl th, .fin-tbl td {
    padding: 3mm 4mm; border-bottom: 1px solid var(--border);
    font-size: 11px;
  }
  .fin-tbl th {
    text-align: left; color: var(--gray);
    font-family: "DM Mono", monospace;
    font-size: 9.5px; letter-spacing: 0.05em; text-transform: uppercase;
    font-weight: 500;
  }
  .fin-tbl td {
    text-align: right; color: var(--midnight); font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .fin-note {
    color: var(--gray); font-size: 10px; line-height: 1.5;
  }

  .section-footer {
    margin-top: 6mm; padding-top: 4mm;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-family: "DM Mono", monospace;
    font-size: 9px; color: var(--gray);
    letter-spacing: 0.08em; text-transform: uppercase;
    flex-shrink: 0;
  }
  .section-footer .dot { color: var(--signal); }
  .page-counter { font-weight: 500; }

  /* ─── Page signature ─── */
  .sign-page {
    width: 210mm; min-height: 297mm;
    padding: 18mm 22mm; display: flex; flex-direction: column;
    background: #fff;
  }
  .sign-intro {
    border-bottom: 1px solid var(--border-strong);
    padding-bottom: 6mm; margin-bottom: 8mm;
  }
  .sign-eyebrow {
    font-family: "DM Mono", monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--signal); margin-bottom: 3mm;
  }
  .sign-title {
    font-size: 24px; font-weight: 500; letter-spacing: -0.02em;
    margin: 0; color: var(--midnight);
  }
  .sign-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12mm;
    margin-top: 8mm;
  }
  .sign-block {
    padding: 6mm 6mm 10mm;
    border: 1px solid var(--border);
    background: #fff;
    min-height: 70mm;
    display: flex; flex-direction: column;
  }
  .sign-block-label {
    font-family: "DM Mono", monospace;
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--gray); margin-bottom: 3mm;
  }
  .sign-block-party {
    font-size: 13px; font-weight: 600; color: var(--midnight);
    margin-bottom: 1.5mm;
  }
  .sign-block-name {
    font-size: 11px; color: var(--gray);
  }
  .sign-block-place {
    margin-top: auto;
    font-family: "DM Mono", monospace;
    font-size: 9.5px; color: var(--gray);
    letter-spacing: 0.05em;
  }
  /* L'ancre {{signature}} est invisible mais détectable par Yousign
     parse_anchors:true — placée dans le bloc signature client. */
  .sign-anchor {
    color: rgba(255,255,255,0); font-size: 1px; line-height: 1;
    user-select: none;
  }
</style>
</head>
<body>
  <!-- ══════════ COVER ══════════ -->
  <div class="cover">
    <div class="cover-top">
      <div class="cover-bar"></div>
      <div class="cover-brand">
        <div class="cover-brand-mark">N</div>
        <span class="cover-brand-name">norva<span class="dot">.</span></span>
      </div>
      <div class="cover-eyebrow">Contrat de prestation</div>
      <h1 class="cover-title">${escapeHtml(c.client_snapshot.raison_sociale)}</h1>
      <p class="cover-subtitle">${escapeHtml(c.ref)}</p>
    </div>
    <div class="cover-bottom">
      <div class="cover-meta">
        <div>
          <div class="meta-label">Référence</div>
          <div class="meta-value">${escapeHtml(c.ref)}</div>
        </div>
        <div>
          <div class="meta-label">Date d'émission</div>
          <div class="meta-value">${escapeHtml(createdDate)}</div>
        </div>
        <div>
          <div class="meta-label">SIRET</div>
          <div class="meta-value">${escapeHtml(c.client_snapshot.siret)}</div>
        </div>
        <div>
          <div class="meta-label">Représentant</div>
          <div class="meta-value">${escapeHtml(
            c.client_snapshot.representant ?? "—"
          )}</div>
        </div>
      </div>
      <div class="cover-footer">
        <span>norva<span class="dot">.</span> · norva-corporate.fr</span>
        <span>Confidentiel</span>
      </div>
    </div>
  </div>

  <!-- ══════════ ARTICLES ══════════ -->
  ${sectionsHtml}

  <!-- ══════════ SIGNATURE ══════════ -->
  <section class="sign-page">
    <div class="sign-intro">
      <div class="sign-eyebrow">Signature</div>
      <h2 class="sign-title">Acceptation des parties</h2>
    </div>
    <p>
      Fait en deux exemplaires originaux, dont un pour chacune des parties,
      par signature électronique simple ayant valeur probante selon le
      règlement européen eIDAS n° 910/2014.
    </p>
    <div class="sign-grid">
      <div class="sign-block">
        <div class="sign-block-label">Le Prestataire</div>
        <div class="sign-block-party">Norva Corporate</div>
        <div class="sign-block-name">Représentant légal</div>
        <div class="sign-block-place">Signé électroniquement</div>
      </div>
      <div class="sign-block">
        <div class="sign-block-label">Le Client</div>
        <div class="sign-block-party">${escapeHtml(
          c.client_snapshot.raison_sociale
        )}</div>
        <div class="sign-block-name">${escapeHtml(
          c.client_snapshot.representant ?? "—"
        )}</div>
        <div class="sign-block-place">
          Signé électroniquement
          <span class="sign-anchor">{{signature}}</span>
        </div>
      </div>
    </div>
  </section>
</body>
</html>`;
}
