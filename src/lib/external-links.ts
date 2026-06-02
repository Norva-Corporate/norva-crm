// ============================================================
// Helpers liens externes — Google Maps / Société.com / Pappers / etc.
// ============================================================
// Construit les URLs cliquables vers les sources externes d'une entreprise
// à partir des données disponibles (SIREN, place_id Google, URL canonique).
//
// Utilisé par :
//  - `src/components/leads/LeadDrawer.tsx` (panneau liens externes du lead)
//  - `src/components/contacts/CompanyDetailClient.tsx` (section "Sources
//    externes" de la fiche entreprise — depuis migration 045).
//
// Le pattern d'extraction `typeof X === "string"` est volontaire :
//  - côté LeadDrawer, on lit `raw_payload` qui est un `Record<string,unknown>`
//  - côté CompanyDetailClient, on lit `Company.siren / place_id / etc.`
//    qui sont nullables.
// Le helper accepte les deux via une signature large.
// ============================================================

import {
  MapPin,
  Building2,
  FileText,
  Briefcase,
  Globe,
  type LucideIcon,
} from "lucide-react";

export interface ExternalLinkItem {
  id: string;
  url: string;
  label: string;
  icon: LucideIcon;
}

export interface ExternalLinksInput {
  google_maps_url?: string | null;
  place_id?: string | null;
  siren?: string | null;
  linkedin?: string | null;
  website?: string | null;
  /** Nom de l'entreprise pour la recherche Pages Jaunes / fallback. */
  company_name?: string | null;
  /** Ville pour la recherche Pages Jaunes. */
  location?: string | null;
}

/**
 * URL Google Maps canonique si fournie ; sinon construite depuis place_id.
 * Retourne null si aucun des deux n'est dispo.
 *
 * Format place_id accepté :
 *   - "ChIJ..." (forme brute)
 *   - "places/ChIJ..." (forme préfixée par l'API Places v1)
 */
export function buildGoogleMapsUrl(input: {
  google_maps_url?: string | null;
  place_id?: string | null;
}): string | null {
  if (typeof input.google_maps_url === "string" && input.google_maps_url) {
    return input.google_maps_url;
  }
  if (typeof input.place_id === "string" && input.place_id) {
    const cleaned = input.place_id.startsWith("places/")
      ? input.place_id.slice(7)
      : input.place_id;
    return `https://www.google.com/maps/place/?q=place_id:${cleaned}`;
  }
  return null;
}

export function buildSocieteUrl(siren?: string | null): string | null {
  if (!siren) return null;
  return `https://www.societe.com/cgi-bin/search?champs=${siren}`;
}

export function buildPappersUrl(siren?: string | null): string | null {
  if (!siren) return null;
  return `https://www.pappers.fr/entreprise/${siren}`;
}

/**
 * Liste structurée des liens externes affichables, dans l'ordre :
 * Google Maps, Société.com, Pappers, LinkedIn, Site web, Pages Jaunes.
 * Les liens absents (donnée manquante) sont simplement omis.
 */
export function buildExternalLinks(
  input: ExternalLinksInput
): ExternalLinkItem[] {
  const items: ExternalLinkItem[] = [];

  const gmaps = buildGoogleMapsUrl(input);
  if (gmaps) {
    items.push({ id: "gmaps", url: gmaps, label: "Google Maps", icon: MapPin });
  }

  const societe = buildSocieteUrl(input.siren);
  if (societe) {
    items.push({
      id: "societe",
      url: societe,
      label: "Société.com",
      icon: Building2,
    });
  }

  const pappers = buildPappersUrl(input.siren);
  if (pappers) {
    items.push({
      id: "pappers",
      url: pappers,
      label: "Pappers",
      icon: FileText,
    });
  }

  if (input.linkedin) {
    items.push({
      id: "linkedin",
      url: input.linkedin,
      label: "LinkedIn",
      icon: Briefcase,
    });
  }

  if (input.website) {
    const normalized = /^https?:\/\//i.test(input.website)
      ? input.website
      : `https://${input.website}`;
    items.push({
      id: "website",
      url: normalized,
      label: "Site web",
      icon: Globe,
    });
  }

  // Pages Jaunes : nom + ville requis ensemble.
  // URL alignée avec celle du LeadDrawer existant (validée fonctionnelle).
  if (input.company_name && input.location) {
    const params = new URLSearchParams({
      quoiqui: input.company_name,
      ou: input.location,
    });
    items.push({
      id: "pagesjaunes",
      url: `https://www.pagesjaunes.fr/recherche/?${params.toString()}`,
      label: "Pages Jaunes",
      icon: FileText,
    });
  }

  return items;
}
