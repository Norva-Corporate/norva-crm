import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ?? "http://localhost:3000/api/auth/gmail/callback"
  );
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    ...(state ? { state } : {}),
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function sendEmail({
  refreshToken,
  to,
  subject,
  body,
  fromName = "Norva Groupe",
  fromEmail = "norvagroupe@gmail.com",
}: {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
}) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const message = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\n");

  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });
}
