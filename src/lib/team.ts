// Contacteurs configurés pour l'éclatement de la colonne "À contacter" du kanban leads.
// Les emails servent de clé de jointure vers `public.profiles` (stable entre environnements,
// contrairement aux UUIDs qui diffèrent en local / staging / prod).

export interface ToContactOwner {
  email: string;
  shortName: string;
  accent: string;
}

export const TO_CONTACT_OWNERS: ReadonlyArray<ToContactOwner> = [
  // Cyan et orange : complémentaires sur la roue chromatique → max contraste.
  // Aucun conflit avec les autres colonnes (Vérifié bleu, Contacté violet,
  // En discussion vert, Stand By gris).
  { email: "kylian.arcier@gmail.com", shortName: "Kylian", accent: "#06B6D4" },
  { email: "lohan.ghrieb2005@gmail.com", shortName: "Lohan", accent: "#F97316" },
];

export function findOwnerByEmail(
  email: string | null | undefined
): ToContactOwner | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  return TO_CONTACT_OWNERS.find((o) => o.email.toLowerCase() === lower) ?? null;
}
