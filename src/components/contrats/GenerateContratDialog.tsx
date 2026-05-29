"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FilePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NO_VALUE = "__none__";

export interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface GenerateContratDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactOption[];
  companies: CompanyOption[];
  defaultRef: string;
  defaultDealId?: string | null;
  defaultContactId?: string | null;
  /** Appelé après envoi à signer, pour rafraîchir l'UI parente */
  onSent?: (contratId: string) => void;
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function GenerateContratDialog({
  open,
  onOpenChange,
  contacts,
  companies,
  defaultRef,
  defaultDealId = null,
  defaultContactId = null,
  onSent,
}: GenerateContratDialogProps) {
  const router = useRouter();

  // ── Étape 1 : formulaire ──
  const [contactId, setContactId] = useState<string>(defaultContactId ?? "");
  const [companyId, setCompanyId] = useState<string>("");
  const [ref, setRef] = useState<string>(defaultRef);
  const [raisonSociale, setRaisonSociale] = useState("");
  const [siret, setSiret] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [representant, setRepresentant] = useState("");
  const [adresse, setAdresse] = useState("");
  const [site, setSite] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [seoAds, setSeoAds] = useState(false);
  const [social, setSocial] = useState(false);
  const [montantTotalStr, setMontantTotalStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [contratId, setContratId] = useState<string | null>(null);

  const companiesById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  useEffect(() => {
    if (!open) return;
    setRef(defaultRef);
    setContactId(defaultContactId ?? "");
  }, [open, defaultRef, defaultContactId]);

  const handleContactChange = (v: string) => {
    if (v === NO_VALUE) {
      setContactId("");
      return;
    }
    setContactId(v);
    const c = contacts.find((x) => x.id === v);
    if (!c) return;
    const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    if (full) setRepresentant((cur) => cur || full);
    if (c.email) setEmail((cur) => cur || (c.email ?? ""));
    if (c.phone) setPhone((cur) => cur || (c.phone ?? ""));
    if (c.company_id) {
      setCompanyId(c.company_id);
      const co = companiesById.get(c.company_id);
      if (co) {
        setRaisonSociale((cur) => cur || co.name);
        if (co.phone) setPhone((cur) => cur || (co.phone ?? ""));
        if (co.address) setAdresse((cur) => cur || (co.address ?? ""));
      }
    }
  };

  const handleCompanyChange = (v: string) => {
    if (v === NO_VALUE) {
      setCompanyId("");
      return;
    }
    setCompanyId(v);
    const co = companiesById.get(v);
    if (!co) return;
    setRaisonSociale((cur) => cur || co.name);
    if (co.phone) setPhone((cur) => cur || (co.phone ?? ""));
    if (co.address) setAdresse((cur) => cur || (co.address ?? ""));
  };

  const montant = Number(montantTotalStr.replace(",", "."));
  const acompte = Number.isFinite(montant) ? montant * 0.3 : NaN;
  const solde = Number.isFinite(montant) ? montant * 0.7 : NaN;

  const siretClean = siret.replace(/\s+/g, "");
  const siretValid = /^\d{14}$/.test(siretClean);
  const optionsValid = site || maintenance || seoAds || social;
  const canSubmit =
    !!ref.trim() &&
    siretValid &&
    optionsValid &&
    Number.isFinite(montant) &&
    montant > 0 &&
    !submitting;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contrats/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: defaultDealId ?? null,
          contact_id: contactId || null,
          ref: ref.trim(),
          options: {
            site,
            maintenance,
            seo_ads: seoAds,
            social,
          },
          montant_total: Number(montant.toFixed(2)),
          client_snapshot_override: {
            raison_sociale: raisonSociale.trim() || undefined,
            siret: siretClean,
            email: email.trim() || undefined,
            phone: phone.trim() || null,
            representant: representant.trim() || null,
            adresse: adresse.trim() || null,
          },
        }),
      });
      const json = (await res.json()) as
        | { contrat_id: string; ref: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Erreur");
        return;
      }
      setContratId(json.contrat_id);
      toast.success(`Contrat ${json.ref} généré`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend() {
    if (!contratId) return;
    if (!email.trim()) {
      toast.error("Email signataire manquant");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/contrats/${contratId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as
        | { statut: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Erreur");
        return;
      }
      toast.success("Contrat envoyé à signer");
      onSent?.(contratId);
      router.refresh();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setContactId(defaultContactId ?? "");
    setCompanyId("");
    setRef(defaultRef);
    setRaisonSociale("");
    setSiret("");
    setEmail("");
    setPhone("");
    setRepresentant("");
    setAdresse("");
    setSite(true);
    setMaintenance(false);
    setSeoAds(false);
    setSocial(false);
    setMontantTotalStr("");
    setContratId(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (submitting || sending) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        {contratId ? (
          <>
            <DialogHeader>
              <DialogTitle>Aperçu du contrat — {ref}</DialogTitle>
              <DialogDescription>
                Vérifie le PDF avant l&apos;envoi à signature électronique.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 md:px-6 pb-4">
              <iframe
                src={`/api/contrats/${contratId}/pdf`}
                title="Aperçu PDF"
                className="w-full h-[60vh] border border-[var(--border)]"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Le signataire recevra l&apos;email Yousign à{" "}
                <span className="font-mono text-foreground">{email}</span>.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                disabled={sending}
              >
                Fermer
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer à signer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleGenerate}>
            <DialogHeader>
              <DialogTitle>Nouveau contrat</DialogTitle>
              <DialogDescription>
                Snapshot client figé à l&apos;envoi. Modifiable ici.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 md:px-6 pb-4 space-y-5">
              {/* Bloc client */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                  Client (snapshot)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact CRM</Label>
                    <Select
                      value={contactId || NO_VALUE}
                      onValueChange={handleContactChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_VALUE}>
                          <span className="text-muted-foreground">Aucun</span>
                        </SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {[c.first_name, c.last_name]
                              .filter(Boolean)
                              .join(" ")
                              .trim() || "(sans nom)"}
                            {c.email ? ` · ${c.email}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Entreprise CRM</Label>
                    <Select
                      value={companyId || NO_VALUE}
                      onValueChange={handleCompanyChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_VALUE}>
                          <span className="text-muted-foreground">Aucune</span>
                        </SelectItem>
                        {companies.map((co) => (
                          <SelectItem key={co.id} value={co.id}>
                            {co.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Raison sociale</Label>
                    <Input
                      value={raisonSociale}
                      onChange={(e) => setRaisonSociale(e.target.value)}
                      placeholder="ex. Acme SAS"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      SIRET <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      inputMode="numeric"
                      placeholder="14 chiffres"
                      className={cn(
                        "font-mono",
                        siret && !siretValid && "border-destructive"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email signataire</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jean@acme.fr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Téléphone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Représentant</Label>
                    <Input
                      value={representant}
                      onChange={(e) => setRepresentant(e.target.value)}
                      placeholder="ex. Jean Dupont"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Adresse</Label>
                    <Input
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      placeholder="ex. 12 rue de la Paix, 75002 Paris"
                    />
                  </div>
                </div>
              </section>

              {/* Bloc contrat */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                  Contrat
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Référence</Label>
                    <Input
                      value={ref}
                      onChange={(e) => setRef(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Montant total (HT)</Label>
                    <Input
                      value={montantTotalStr}
                      onChange={(e) => setMontantTotalStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="ex. 8500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <OptionToggle
                    label="Site"
                    checked={site}
                    onChange={setSite}
                  />
                  <OptionToggle
                    label="Maintenance"
                    checked={maintenance}
                    onChange={setMaintenance}
                  />
                  <OptionToggle
                    label="SEO / Ads"
                    checked={seoAds}
                    onChange={setSeoAds}
                  />
                  <OptionToggle
                    label="Social"
                    checked={social}
                    onChange={setSocial}
                  />
                </div>
                {!optionsValid && (
                  <p className="text-xs text-destructive">
                    Sélectionne au moins une option.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 border border-[var(--border)] bg-[var(--muted)]">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                      Acompte (30 %)
                    </div>
                    <div className="text-base font-semibold text-foreground mt-1">
                      {fmtMoney(acompte)}
                    </div>
                  </div>
                  <div className="p-3 border border-[var(--border)] bg-[var(--muted)]">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                      Solde (70 %)
                    </div>
                    <div className="text-base font-semibold text-foreground mt-1">
                      {fmtMoney(solde)}
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FilePlus className="h-4 w-4" />
                )}
                Générer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "px-3 py-2 text-xs border transition-colors text-left",
        checked
          ? "bg-accent/15 border-accent/40 text-accent"
          : "bg-[var(--card)] border-[var(--border)] text-muted-foreground hover:text-foreground"
      )}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}
