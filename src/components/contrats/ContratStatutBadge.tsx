import { Badge } from "@/components/ui/badge";
import type { ContratStatut } from "@/types";

const LABELS: Record<ContratStatut, string> = {
  brouillon: "Brouillon",
  genere: "Généré",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
};

const VARIANTS: Record<ContratStatut, React.ComponentProps<typeof Badge>["variant"]> = {
  brouillon: "secondary",
  genere: "contrat_genere",
  envoye: "contrat_envoye",
  signe: "contrat_signe",
  refuse: "contrat_refuse",
  expire: "contrat_expire",
};

export function ContratStatutBadge({ statut }: { statut: ContratStatut }) {
  return <Badge variant={VARIANTS[statut]}>{LABELS[statut]}</Badge>;
}
