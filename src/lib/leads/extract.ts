// Best-effort extraction of common lead fields from arbitrary payloads.
// Multica.ai (and other prospect sources) tend to use slightly different
// keys; we try a list of common aliases and fall back gracefully.

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.fr",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "icloud.com",
  "aol.com",
  "live.com",
  "live.fr",
  "free.fr",
  "wanadoo.fr",
  "orange.fr",
  "laposte.net",
]);

export interface ExtractedLead {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string | null;
  companyName: string | null;
  companyDomain: string | null;
  externalId: string | null;
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean")
      return String(v).trim();
  }
  return null;
}

function cleanDomain(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim() || null;
}

export function extractLeadFields(payload: unknown): ExtractedLead {
  const obj =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const email = pickString(obj, [
    "email",
    "email_address",
    "emailAddress",
    "mail",
    "work_email",
    "workEmail",
    "professional_email",
  ])?.toLowerCase() ?? null;

  let firstName = pickString(obj, [
    "first_name",
    "firstName",
    "firstname",
    "given_name",
    "givenName",
    "prenom",
  ]);
  let lastName = pickString(obj, [
    "last_name",
    "lastName",
    "lastname",
    "family_name",
    "familyName",
    "surname",
    "nom",
  ]);

  if (!firstName && !lastName) {
    const fullName = pickString(obj, [
      "full_name",
      "fullName",
      "name",
      "contact_name",
      "contactName",
    ]);
    if (fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] ?? null;
      lastName = parts.slice(1).join(" ") || null;
    }
  }

  const phone = pickString(obj, [
    "phone",
    "phone_number",
    "phoneNumber",
    "mobile",
    "telephone",
    "tel",
  ]);

  const role = pickString(obj, [
    "role",
    "title",
    "job_title",
    "jobTitle",
    "position",
    "fonction",
    "poste",
  ]);

  const companyName = pickString(obj, [
    "company",
    "company_name",
    "companyName",
    "organization",
    "organisation",
    "entreprise",
    "société",
    "societe",
  ]);

  let companyDomain = cleanDomain(
    pickString(obj, [
      "domain",
      "company_domain",
      "companyDomain",
      "website",
      "site",
      "url",
    ])
  );
  if (!companyDomain && email) {
    const at = email.indexOf("@");
    if (at > 0) {
      const dom = email.slice(at + 1).toLowerCase();
      if (!FREE_EMAIL_DOMAINS.has(dom)) companyDomain = dom;
    }
  }

  const externalId = pickString(obj, [
    "id",
    "lead_id",
    "leadId",
    "external_id",
    "externalId",
    "uuid",
  ]);

  return {
    email,
    firstName,
    lastName,
    phone,
    role,
    companyName,
    companyDomain,
    externalId,
  };
}
