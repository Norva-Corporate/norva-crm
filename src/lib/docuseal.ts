import "server-only";

// ──────────────────────────────────────────────────────────────
// Wrapper DocuSeal API v1 (https://www.docuseal.com/docs/api)
// Cloud : https://api.docuseal.com
// Self-host : https://<ton-domaine>/api
// Auth : header `X-Auth-Token: <api_key>`
// ──────────────────────────────────────────────────────────────

const RETRY_5XX_MS = 500;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new DocusealError(500, "env_missing", `Missing env: ${name}`);
  return v;
}

export class DocusealError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function dsFetch<T>(
  path: string,
  init: RequestInit & { retry5xx?: boolean } = {}
): Promise<T> {
  const baseUrl = envOrThrow("DOCUSEAL_API_URL").replace(/\/$/, "");
  const apiKey = envOrThrow("DOCUSEAL_API_KEY");

  const headers = new Headers(init.headers);
  if (!headers.has("X-Auth-Token")) headers.set("X-Auth-Token", apiKey);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const url = `${baseUrl}${path}`;
  const doRequest = () => fetch(url, { ...init, headers });

  let res = await doRequest();
  if (res.status >= 500 && init.retry5xx !== false) {
    await new Promise((r) => setTimeout(r, RETRY_5XX_MS));
    res = await doRequest();
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      detail = res.statusText;
    }
    throw new DocusealError(
      res.status,
      `docuseal_${res.status}`,
      `DocuSeal ${path}: ${res.status} ${detail.slice(0, 500)}`
    );
  }

  return (await res.json()) as T;
}

async function dsFetchBinary(url: string): Promise<Buffer> {
  // DocuSeal expose les documents signés via des URLs présignées sur S3
  // ou son CDN — on les télécharge directement sans header d'auth.
  const res = await fetch(url);
  if (!res.ok) {
    throw new DocusealError(
      res.status,
      `docuseal_${res.status}`,
      `DocuSeal binary ${url}: ${res.status}`
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Types ───────────────────────────────────────────────────

export interface DocusealField {
  name: string;
  type: "signature" | "text" | "date" | "checkbox" | "initials";
  required?: boolean;
  areas: Array<{
    page: number; // 0-indexed
    x: number; // normalized 0..1 (fraction of page width)
    y: number;
    w: number;
    h: number;
  }>;
}

export interface DocusealTemplate {
  id: number;
  slug: string;
  name: string;
  schema: Array<{ name: string; document_id?: number }>;
  documents?: Array<{ id: number; name: string }>;
}

export interface DocusealSubmitter {
  id: number;
  submission_id: number;
  uuid: string;
  email: string;
  slug: string;
  name?: string | null;
  status: string; // "awaiting" | "opened" | "completed" | "declined" | "expired"
  completed_at?: string | null;
  declined_at?: string | null;
  documents?: Array<{
    name: string;
    url: string;
  }>;
}

export interface DocusealSubmission {
  id: number;
  source: string;
  status: string;
  audit_log_url?: string | null;
  combined_document_url?: string | null;
  submitters: DocusealSubmitter[];
  documents?: Array<{
    name: string;
    url: string;
  }>;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Crée un template à partir d'un PDF (envoyé en base64) avec les champs
 * de signature placés à des coordonnées explicites.
 *
 * @see https://www.docuseal.com/docs/api#create-pdf-template
 */
export async function createTemplateFromPdf(input: {
  name: string;
  pdfBuffer: Buffer;
  filename: string;
  fields: DocusealField[];
}): Promise<DocusealTemplate> {
  return dsFetch<DocusealTemplate>("/templates/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      documents: [
        {
          name: input.filename,
          file: input.pdfBuffer.toString("base64"),
          fields: input.fields,
        },
      ],
    }),
  });
}

/**
 * Crée une submission (instance de signature) à partir d'un template.
 * Envoie l'email d'invitation au signataire en mode `send_email: true`.
 *
 * @see https://www.docuseal.com/docs/api#create-submission
 *
 * NOTE: l'endpoint retourne un ARRAY de submitters (un par signataire).
 * Pour un seul signataire on prend response[0]. Le submission_id est
 * disponible sur chaque submitter.
 */
export async function createSubmission(input: {
  templateId: number;
  signer: {
    email: string;
    name?: string;
    phone?: string;
    role?: string;
  };
  sendEmail?: boolean;
}): Promise<DocusealSubmitter> {
  const submitters = await dsFetch<DocusealSubmitter[]>("/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: input.templateId,
      send_email: input.sendEmail ?? true,
      submitters: [
        {
          role: input.signer.role ?? "Client",
          email: input.signer.email,
          name: input.signer.name,
          phone: input.signer.phone,
        },
      ],
    }),
  });
  if (!Array.isArray(submitters) || submitters.length === 0) {
    throw new DocusealError(
      502,
      "docuseal_empty_response",
      "DocuSeal create submission returned an empty submitters array"
    );
  }
  return submitters[0];
}

export async function fetchSubmission(
  submissionId: number
): Promise<DocusealSubmission> {
  return dsFetch<DocusealSubmission>(`/submissions/${submissionId}`);
}

/**
 * Récupère le PDF signé (document combiné) d'une submission complétée.
 * DocuSeal expose `combined_document_url` sur la submission après
 * complétion. Fallback : on cherche un document dans submitter.documents.
 */
export async function downloadSignedPdf(
  submissionId: number
): Promise<Buffer> {
  const sub = await fetchSubmission(submissionId);
  const url =
    sub.combined_document_url ??
    sub.documents?.[0]?.url ??
    sub.submitters?.[0]?.documents?.[0]?.url;
  if (!url) {
    throw new DocusealError(
      404,
      "docuseal_no_signed_pdf",
      `No signed document URL for submission ${submissionId}`
    );
  }
  return dsFetchBinary(url);
}

/**
 * Récupère le dossier de preuve (audit trail) d'une submission complétée.
 * DocuSeal génère un PDF d'audit avec horodatage, IP, OTP utilisé, etc.
 */
export async function downloadAuditLog(
  submissionId: number
): Promise<Buffer | null> {
  const sub = await fetchSubmission(submissionId);
  if (!sub.audit_log_url) return null;
  return dsFetchBinary(sub.audit_log_url);
}
