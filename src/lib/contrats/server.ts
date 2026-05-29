import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratClientSnapshot } from "@/lib/contrats/template";

export type ContratActivityType =
  | "contract_generated"
  | "contract_sent"
  | "contract_signed"
  | "contract_refused"
  | "contract_expired";

/**
 * Insert une activity système liée à un contrat. Utilisé côté serveur
 * (service role) car le helper createActivity côté UI restreint à des
 * types manuels (note/call/meeting/email).
 */
export async function insertContratActivity(
  service: SupabaseClient,
  contratId: string,
  type: ContratActivityType,
  payload: Record<string, unknown>,
  createdBy?: string | null
): Promise<void> {
  const { error } = await service.from("activities").insert({
    type,
    entity_type: "contrat",
    entity_id: contratId,
    payload,
    created_by: createdBy ?? null,
  });
  if (error) {
    console.error("[contrats/server] insertContratActivity error:", error);
  }
}

export interface FreezeSnapshotInput {
  dealId?: string | null;
  contactId?: string | null;
  override: {
    siret: string;
    raison_sociale?: string;
    email?: string;
    phone?: string | null;
    representant?: string | null;
    adresse?: string | null;
  };
}

/**
 * Construit le client_snapshot figé à l'envoi du contrat : on part des
 * données contact + company actuelles, et on superpose les overrides
 * saisis dans la modale. Le SIRET vient toujours de la modale (aucune
 * colonne SIRET n'existe sur companies/contacts).
 */
export async function freezeClientSnapshot(
  service: SupabaseClient,
  input: FreezeSnapshotInput
): Promise<ContratClientSnapshot> {
  let contact: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    company_id: string | null;
  } | null = null;

  let company: {
    name: string;
    phone: string | null;
    address: string | null;
  } | null = null;

  if (input.contactId) {
    const { data } = await service
      .from("contacts")
      .select("first_name, last_name, email, phone, company_id")
      .eq("id", input.contactId)
      .maybeSingle();
    contact = data ?? null;
  }

  // Sinon, depuis le deal → contact_id / company_id
  if (!contact && input.dealId) {
    const { data: deal } = await service
      .from("deals")
      .select("contact_id, company_id")
      .eq("id", input.dealId)
      .maybeSingle();
    if (deal?.contact_id) {
      const { data } = await service
        .from("contacts")
        .select("first_name, last_name, email, phone, company_id")
        .eq("id", deal.contact_id)
        .maybeSingle();
      contact = data ?? null;
    }
    if (deal?.company_id) {
      const { data } = await service
        .from("companies")
        .select("name, phone, address")
        .eq("id", deal.company_id)
        .maybeSingle();
      company = data ?? null;
    }
  }

  if (!company && contact?.company_id) {
    const { data } = await service
      .from("companies")
      .select("name, phone, address")
      .eq("id", contact.company_id)
      .maybeSingle();
    company = data ?? null;
  }

  const fullName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
    : "";

  return {
    raison_sociale:
      input.override.raison_sociale?.trim() ||
      company?.name ||
      fullName ||
      "Client",
    siret: input.override.siret.trim(),
    email: input.override.email?.trim() || contact?.email || "",
    phone:
      input.override.phone?.trim() ||
      contact?.phone ||
      company?.phone ||
      null,
    representant:
      input.override.representant?.trim() || fullName || null,
    adresse:
      input.override.adresse?.trim() || company?.address || null,
  };
}
