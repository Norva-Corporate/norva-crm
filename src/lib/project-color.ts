// ============================================================
// Couleur déterministe par projet
// ============================================================
// Génère une couleur stable et bien distincte pour chaque projet
// à partir de son uuid. Utilisé pour distinguer visuellement les
// tâches d'un projet à un autre (calendrier, page tâches, fiche).
//
// Palette de 12 couleurs choisies pour être suffisamment
// éloignées en teinte ET en luminosité.

const PROJECT_PALETTE = [
  "#3B82F6", // bleu
  "#A855F7", // violet
  "#EC4899", // rose
  "#F59E0B", // orange
  "#10B981", // vert
  "#06B6D4", // cyan
  "#F97316", // orange-rouge
  "#8B5CF6", // violet-clair
  "#14B8A6", // teal
  "#EAB308", // jaune
  "#6366F1", // indigo
  "#D946EF", // fuchsia
] as const;

/** Renvoie une couleur déterministe pour un id de projet. */
export function getProjectColor(projectId: string | null | undefined): string {
  if (!projectId) return "#64748B"; // gris neutre par défaut
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}

/**
 * Préfixe un label avec le nom du projet (max 18 chars) entre crochets.
 * Si pas de projet, retourne le label tel quel.
 */
export function withProjectPrefix(
  label: string,
  projectName: string | null | undefined
): string {
  if (!projectName) return label;
  const short =
    projectName.length > 18 ? projectName.slice(0, 17) + "…" : projectName;
  return `[${short}] ${label}`;
}
