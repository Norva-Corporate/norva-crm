import "server-only";

// ──────────────────────────────────────────────────────────────
// Wrapper Yousign API v3 (https://developers.yousign.com)
// Sandbox: https://api-sandbox.yousign.app/v3
// Prod:    https://api.yousign.app/v3
// ──────────────────────────────────────────────────────────────

const RETRY_5XX_MS = 500;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new YousignError(500, "env_missing", `Missing env: ${name}`);
  return v;
}

export class YousignError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function ysFetch<T>(
  path: string,
  init: RequestInit & { retry5xx?: boolean } = {}
): Promise<T> {
  const baseUrl = envOrThrow("YOUSIGN_API_URL").replace(/\/$/, "");
  const apiKey = envOrThrow("YOUSIGN_API_KEY");

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const doRequest = () =>
    fetch(`${baseUrl}${path}`, { ...init, headers });

  let res = await doRequest();
  if (res.status >= 500 && init.retry5xx !== false) {
    await new Promise((r) => setTimeout(r, RETRY_5XX_MS));
    res = await doRequest();
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let detail = "";
    try {
      detail = contentType.includes("application/json")
        ? JSON.stringify(await res.json())
        : await res.text();
    } catch {
      detail = res.statusText;
    }
    throw new YousignError(
      res.status,
      `yousign_${res.status}`,
      `Yousign ${path} failed: ${res.status} ${detail.slice(0, 500)}`
    );
  }

  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  // fallthrough: caller is expected to use raw fetch for binary
  return (await res.text()) as unknown as T;
}

// ── Binary download (used by signed PDF / audit trail) ──────
async function ysFetchBinary(path: string): Promise<Buffer> {
  const baseUrl = envOrThrow("YOUSIGN_API_URL").replace(/\/$/, "");
  const apiKey = envOrThrow("YOUSIGN_API_KEY");

  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new YousignError(
      res.status,
      `yousign_${res.status}`,
      `Yousign binary ${path} failed: ${res.status} ${res.statusText}`
    );
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ── Types ───────────────────────────────────────────────────
export interface SignatureRequestCreated {
  id: string;
  status: string;
  name: string;
}

export interface DocumentAdded {
  id: string;
  // Yousign v3 returns parsed anchor fields when parse_anchors=true.
  // Champs présents pour pouvoir les binder au signataire ensuite.
  fields?: Array<{
    id: string;
    type: string;
    page: number;
    document_id?: string;
  }>;
}

export interface SignerAdded {
  id: string;
  status: string;
}

export interface SignatureRequest {
  id: string;
  status: string;
  documents?: Array<{ id: string; nature?: string }>;
  signers?: Array<{ id: string; status: string; email?: string }>;
}

// ── Public API ──────────────────────────────────────────────

export async function createSignatureRequest(input: {
  name: string;
  delivery_mode?: "email" | "none";
  timezone?: string;
  ordered_signers?: boolean;
}): Promise<SignatureRequestCreated> {
  return ysFetch<SignatureRequestCreated>("/signature_requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      delivery_mode: input.delivery_mode ?? "email",
      timezone: input.timezone ?? "Europe/Paris",
      ordered_signers: input.ordered_signers ?? false,
    }),
  });
}

export async function addDocument(
  signatureRequestId: string,
  file: Buffer,
  opts: {
    nature?: "signable_document" | "attachment";
    parse_anchors?: boolean;
    filename?: string;
  } = {}
): Promise<DocumentAdded> {
  const form = new FormData();
  // Buffer → Blob (Node 18+ exposes global Blob)
  // Pour FormData côté Node, on utilise Blob avec arraybuffer.
  const blob = new Blob([new Uint8Array(file)], { type: "application/pdf" });
  form.append("file", blob, opts.filename ?? "contrat.pdf");
  form.append("nature", opts.nature ?? "signable_document");
  if (opts.parse_anchors !== false) {
    form.append("parse_anchors", "true");
  }
  return ysFetch<DocumentAdded>(
    `/signature_requests/${signatureRequestId}/documents`,
    { method: "POST", body: form }
  );
}

export interface SignerInput {
  info: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    locale?: string;
  };
  signature_level?: "electronic_signature" | "advanced_electronic_signature";
  signature_authentication_mode?: "otp_email" | "otp_sms" | "no_otp";
  fields?: Array<{
    document_id: string;
    type: "signature";
    page?: number;
    x?: number;
    y?: number;
    // Pour les fields déjà parsés via parse_anchors (auto-créés à l'upload),
    // on peut fournir l'id pour les lier au signataire.
    field_id?: string;
  }>;
}

export async function addSigner(
  signatureRequestId: string,
  input: SignerInput
): Promise<SignerAdded> {
  return ysFetch<SignerAdded>(
    `/signature_requests/${signatureRequestId}/signers`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        info: { locale: "fr", ...input.info },
        signature_level: input.signature_level ?? "electronic_signature",
        signature_authentication_mode:
          input.signature_authentication_mode ?? "otp_email",
        fields: input.fields ?? [],
      }),
    }
  );
}

export async function activateSignatureRequest(
  signatureRequestId: string
): Promise<SignatureRequest> {
  return ysFetch<SignatureRequest>(
    `/signature_requests/${signatureRequestId}/activate`,
    { method: "POST" }
  );
}

export async function fetchSignatureRequest(
  signatureRequestId: string
): Promise<SignatureRequest> {
  return ysFetch<SignatureRequest>(
    `/signature_requests/${signatureRequestId}`,
    { method: "GET" }
  );
}

export async function downloadSignedDocument(
  signatureRequestId: string,
  documentId: string
): Promise<Buffer> {
  return ysFetchBinary(
    `/signature_requests/${signatureRequestId}/documents/${documentId}/download`
  );
}

/**
 * Télécharge le dossier de preuve (audit trail) de la signature.
 * Endpoint v3 actuel : /signature_requests/{id}/audit_trails/download.
 * À vérifier sur developers.yousign.com si l'API évolue.
 */
export async function downloadAuditTrail(
  signatureRequestId: string
): Promise<Buffer> {
  return ysFetchBinary(
    `/signature_requests/${signatureRequestId}/audit_trails/download`
  );
}
