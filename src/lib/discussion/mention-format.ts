import type { Mention, MentionType } from "@/types";

const MENTION_TYPES: ReadonlyArray<MentionType> = [
  "user",
  "company",
  "contact",
  "project",
  "task",
  "invoice",
];

export const MENTION_HREF_PREFIX = "mention://";

export function buildMentionHref(type: MentionType, id: string): string {
  return `${MENTION_HREF_PREFIX}${type}/${id}`;
}

export function parseMentionHref(
  href: string
): { type: MentionType; id: string } | null {
  if (!href.startsWith(MENTION_HREF_PREFIX)) return null;
  const rest = href.slice(MENTION_HREF_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const type = rest.slice(0, slash) as MentionType;
  const id = rest.slice(slash + 1);
  if (!MENTION_TYPES.includes(type) || !id) return null;
  return { type, id };
}

export function renderMentionMarkdown(mention: Mention): string {
  const safeLabel = mention.label.replace(/[\[\]]/g, "");
  return `[@${safeLabel}](${buildMentionHref(mention.type, mention.id)})`;
}

const MENTION_REGEX = /\[@([^\]]+)\]\(mention:\/\/([a-z]+)\/([0-9a-fA-F-]+)\)/g;

export function extractMentions(content: string): Mention[] {
  const seen = new Set<string>();
  const mentions: Mention[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const [, label, type, id] = match;
    if (!MENTION_TYPES.includes(type as MentionType)) continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({ type: type as MentionType, id, label });
  }
  return mentions;
}

export function buildMentionLink(type: MentionType, id: string): string {
  switch (type) {
    case "user":
      return `/dashboard/profil`;
    case "company":
      return `/dashboard/companies/${id}`;
    case "contact":
      return `/dashboard/contacts/${id}`;
    case "project":
      return `/dashboard/projets/${id}`;
    case "task":
      return `/dashboard/taches?id=${id}`;
    case "invoice":
      return `/dashboard/facturation/${id}`;
    default:
      return "/dashboard";
  }
}

export function mentionLabelPrefix(type: MentionType): string {
  switch (type) {
    case "user":
      return "Membres";
    case "company":
      return "Entreprises";
    case "contact":
      return "Contacts";
    case "project":
      return "Projets";
    case "task":
      return "Tâches";
    case "invoice":
      return "Factures";
  }
}

export function excerpt(text: string, maxLength = 80): string {
  const cleaned = text
    .replace(MENTION_REGEX, (_m, label) => `@${label}`)
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 1) + "…";
}
