import "server-only";

import {
  MailerSend,
  EmailParams,
  Sender,
  Recipient,
  Attachment,
} from "mailersend";
import type { ContratClientSnapshot } from "@/lib/contrats/template";

export interface ContratNotifyContext {
  contratId: string;
  ref: string;
  client: ContratClientSnapshot;
  montant_total: number;
  signedAt: string; // ISO
}

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.norva-corporate.fr"
).replace(/\/$/, "");

function envFromEmail(): string | undefined {
  return process.env.CONTRAT_FROM_EMAIL ?? process.env.BRIEF_FROM_EMAIL;
}
function envFromName(): string {
  return (
    process.env.CONTRAT_FROM_NAME ?? process.env.BRIEF_FROM_NAME ?? "norva."
  );
}
function envInternalTo(): string | undefined {
  return process.env.CONTRAT_NOTIFY_EMAIL ?? process.env.BRIEF_NOTIFY_EMAIL;
}
function envApiKey(): string | undefined {
  return process.env.MAILERSEND_API_KEY;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function shellHtml(opts: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; url: string };
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0B1220; line-height:1.6; max-width:640px;">
      <div style="border-left:3px solid #3B7BF5; padding-left:16px; margin-bottom:24px;">
        <p style="margin:0; font-family:monospace; font-size:10px; letter-spacing:0.10em; text-transform:uppercase; color:#3B7BF5;">${escapeHtml(
          opts.eyebrow
        )}</p>
        <h2 style="margin:8px 0 0; color:#0B1220; font-weight:500; letter-spacing:-0.02em;">
          ${escapeHtml(opts.title)}
        </h2>
      </div>
      ${opts.body}
      ${
        opts.cta
          ? `<div style="margin-top:32px; padding-top:24px; border-top:1px solid #E5E7EB;">
              <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block; padding:12px 24px; background:#3B7BF5; color:#fff; text-decoration:none; font-family:monospace; font-size:11px; letter-spacing:0.10em; text-transform:uppercase;">
                ${escapeHtml(opts.cta.label)}
              </a>
            </div>`
          : ""
      }
      <p style="margin-top:32px; font-family:monospace; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#8A99B8;">
        norva<span style="color:#3B7BF5;">.</span>
      </p>
    </div>
  `;
}

/**
 * Email interne à l'équipe Norva quand un contrat est signé.
 * Tolérant : missing env → skip + log.
 */
export async function sendContratSignedInternal(
  ctx: ContratNotifyContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = envApiKey();
  const fromEmail = envFromEmail();
  const toEmail = envInternalTo();
  if (!apiKey || !fromEmail || !toEmail) {
    console.warn(
      "[contrats/notify] internal skipped — missing MAILERSEND_API_KEY / CONTRAT_FROM_EMAIL / CONTRAT_NOTIFY_EMAIL"
    );
    return { ok: false, skipped: true };
  }

  const contratUrl = `${APP_URL}/dashboard/contrats?id=${ctx.contratId}`;
  const subject = `✓ Contrat signé — ${ctx.ref} · ${ctx.client.raison_sociale}`;
  const html = shellHtml({
    eyebrow: "Contrat signé",
    title: `${ctx.client.raison_sociale} a signé ${ctx.ref}`,
    body: `
      <table style="border-collapse:collapse; width:100%; margin-bottom:24px;">
        <tr><td style="padding:6px 0; color:#8A99B8; width:140px; font-size:12px;">Référence</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(
          ctx.ref
        )}</td></tr>
        <tr><td style="padding:6px 0; color:#8A99B8; font-size:12px;">Client</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(
          ctx.client.raison_sociale
        )}</td></tr>
        <tr><td style="padding:6px 0; color:#8A99B8; font-size:12px;">SIRET</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(
          ctx.client.siret
        )}</td></tr>
        <tr><td style="padding:6px 0; color:#8A99B8; font-size:12px;">Montant total</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(
          fmtMoney(ctx.montant_total)
        )}</td></tr>
        <tr><td style="padding:6px 0; color:#8A99B8; font-size:12px;">Signé le</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(
          new Date(ctx.signedAt).toLocaleString("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
          })
        )}</td></tr>
      </table>
    `,
    cta: { label: "Ouvrir dans le CRM", url: contratUrl },
  });

  try {
    const ms = new MailerSend({ apiKey });
    const params = new EmailParams()
      .setFrom(new Sender(fromEmail, envFromName()))
      .setTo([new Recipient(toEmail)])
      .setSubject(subject)
      .setHtml(html);
    await ms.email.send(params);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[contrats/notify] internal MailerSend error:", err);
    return { ok: false, error: message };
  }
}

/**
 * Email au client signataire avec le PDF signé en pièce jointe.
 * Tolérant : missing env → skip + log.
 */
export async function sendContratSignedClient(
  ctx: ContratNotifyContext,
  signedPdf: Buffer,
  filename: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = envApiKey();
  const fromEmail = envFromEmail();
  if (!apiKey || !fromEmail) {
    console.warn(
      "[contrats/notify] client skipped — missing MAILERSEND_API_KEY / CONTRAT_FROM_EMAIL"
    );
    return { ok: false, skipped: true };
  }
  if (!ctx.client.email) {
    console.warn(
      "[contrats/notify] client skipped — no client email in snapshot"
    );
    return { ok: false, skipped: true };
  }

  const subject = `Votre contrat signé — ${ctx.ref}`;
  const html = shellHtml({
    eyebrow: "Contrat signé",
    title: "Votre contrat est signé ✓",
    body: `
      <p>Bonjour ${escapeHtml(
        ctx.client.representant ?? ctx.client.raison_sociale
      )},</p>
      <p>
        Nous vous confirmons la signature électronique de votre contrat
        de prestation Norva, sous la référence
        <strong>${escapeHtml(ctx.ref)}</strong>.
      </p>
      <p>
        Vous trouverez ci-joint le PDF signé. Notre équipe revient vers
        vous très prochainement pour la suite des opérations.
      </p>
      <p style="color:#6B7280; font-size:12px;">
        Le dossier de preuve (audit trail eIDAS) est conservé par nos
        soins et reste disponible sur simple demande.
      </p>
    `,
  });

  try {
    const ms = new MailerSend({ apiKey });
    const attachment = new Attachment(
      signedPdf.toString("base64"),
      filename,
      "attachment"
    );
    const params = new EmailParams()
      .setFrom(new Sender(fromEmail, envFromName()))
      .setTo([new Recipient(ctx.client.email)])
      .setSubject(subject)
      .setHtml(html)
      .setAttachments([attachment]);
    await ms.email.send(params);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[contrats/notify] client MailerSend error:", err);
    return { ok: false, error: message };
  }
}
