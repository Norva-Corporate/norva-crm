import "server-only";

import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import {
  groupReponsesBySections,
  labelForOption,
} from "@/lib/briefs/sections";

interface BriefNotificationPayload {
  briefId: string;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  reponses: Record<string, unknown>;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function previewValue(value: unknown, fieldKey?: string): string {
  if (value === null || value === undefined || value === "") return "(vide)";
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed.length > 140 ? trimmed.slice(0, 137) + "…" : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "(vide)";
    if (value.every((v) => typeof v === "string")) {
      const labels = (value as string[])
        .slice(0, 3)
        .map((v) => (fieldKey ? labelForOption(fieldKey, v) : v));
      const more = value.length > 3 ? ` + ${value.length - 3}` : "";
      return labels.join(", ") + more;
    }
    const filled = value.filter(
      (v) =>
        v &&
        typeof v === "object" &&
        Object.values(v as Record<string, unknown>).some(
          (x) => typeof x === "string" && x.trim()
        )
    );
    return `${filled.length} entrée${filled.length > 1 ? "s" : ""}`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== "" && v != null
    );
    if (entries.length === 0) return "(vide)";
    return `${entries.length} champ${entries.length > 1 ? "s" : ""} renseigné${
      entries.length > 1 ? "s" : ""
    }`;
  }
  return "(complexe)";
}

/**
 * Envoie l'email de notification à la soumission d'un brief.
 * Tolérant aux erreurs : log + return false si la config MailerSend manque
 * ou si l'envoi échoue. Ne doit jamais faire échouer la soumission.
 */
export async function sendBriefNotificationEmail(
  payload: BriefNotificationPayload
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.BRIEF_FROM_EMAIL;
  const fromName = process.env.BRIEF_FROM_NAME ?? "norva.";
  const toEmail = process.env.BRIEF_NOTIFY_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    console.warn(
      "[briefs/notify] skipped — missing MAILERSEND_API_KEY / BRIEF_FROM_EMAIL / BRIEF_NOTIFY_EMAIL"
    );
    return { ok: false, skipped: true };
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.norva-corporate.fr"
  ).replace(/\/$/, "");
  const briefUrl = `${appUrl}/dashboard/briefs/${payload.briefId}`;

  const grouped = groupReponsesBySections(payload.reponses);
  const sectionsRows = grouped.sections
    .map((s) => {
      const firstFilled = s.fields.find(
        (f) => f.value !== null && f.value !== undefined && f.value !== ""
      );
      const preview = firstFilled
        ? previewValue(firstFilled.value, firstFilled.key)
        : "(vide)";
      return `
        <tr>
          <td style="padding:8px 0; color:#8A99B8; width:240px; vertical-align:top; font-size:12px;">
            ${escapeHtml(s.section.label)}
          </td>
          <td style="padding:8px 0; color:#0B1220; font-size:13px;">
            ${escapeHtml(preview)}
          </td>
        </tr>
      `;
    })
    .join("");

  const subject = `Nouveau brief — ${payload.prospect_nom ?? "Prospect"}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0B1220; line-height:1.6; max-width:640px;">
      <div style="border-left:3px solid #3B7BF5; padding-left:16px; margin-bottom:24px;">
        <p style="margin:0; font-family:monospace; font-size:10px; letter-spacing:0.10em; text-transform:uppercase; color:#3B7BF5;">Brief client</p>
        <h2 style="margin:8px 0 0; color:#0B1220; font-weight:500; letter-spacing:-0.02em;">
          ${escapeHtml(payload.prospect_nom ?? "Prospect")}
        </h2>
      </div>

      <table style="border-collapse:collapse; width:100%; margin-bottom:24px;">
        ${payload.prospect_entreprise ? `<tr><td style="padding:6px 0; color:#8A99B8; width:120px; font-size:12px;">Entreprise</td><td style="color:#0B1220; font-size:13px;">${escapeHtml(payload.prospect_entreprise)}</td></tr>` : ""}
        ${payload.prospect_email ? `<tr><td style="padding:6px 0; color:#8A99B8; width:120px; font-size:12px;">Email</td><td style="color:#0B1220; font-size:13px;"><a href="mailto:${escapeHtml(payload.prospect_email)}" style="color:#3B7BF5;">${escapeHtml(payload.prospect_email)}</a></td></tr>` : ""}
        <tr><td style="padding:6px 0; color:#8A99B8; width:120px; font-size:12px;">Sections remplies</td><td style="color:#0B1220; font-size:13px;">${grouped.sections.length} / 10</td></tr>
      </table>

      <h3 style="font-size:11px; font-family:monospace; letter-spacing:0.10em; text-transform:uppercase; color:#8A99B8; margin:0 0 12px;">Aperçu par section</h3>
      <table style="border-collapse:collapse; width:100%; border-top:1px solid #E5E7EB;">
        ${sectionsRows || `<tr><td style="padding:12px 0; color:#8A99B8; font-size:12px;">Aucune section remplie</td></tr>`}
      </table>

      <div style="margin-top:32px; padding-top:24px; border-top:1px solid #E5E7EB;">
        <a href="${escapeHtml(briefUrl)}" style="display:inline-block; padding:12px 24px; background:#3B7BF5; color:#fff; text-decoration:none; font-family:monospace; font-size:11px; letter-spacing:0.10em; text-transform:uppercase;">
          Ouvrir dans le CRM
        </a>
      </div>

      <p style="margin-top:32px; font-family:monospace; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#8A99B8;">
        norva<span style="color:#3B7BF5;">.</span>
      </p>
    </div>
  `;

  try {
    const mailerSend = new MailerSend({ apiKey });
    const sender = new Sender(fromEmail, fromName);
    const recipients = [new Recipient(toEmail)];

    const emailParams = new EmailParams()
      .setFrom(sender)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(html);

    if (payload.prospect_email) {
      emailParams.setReplyTo(new Sender(payload.prospect_email));
    }

    await mailerSend.email.send(emailParams);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[briefs/notify] MailerSend error:", err);
    return { ok: false, error: message };
  }
}
