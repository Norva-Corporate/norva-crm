"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ContactOption,
  CompanyOption,
} from "@/lib/actions/briefs";

const DURATIONS: { value: string; label: string }[] = [
  { value: "24", label: "24 heures" },
  { value: "48", label: "48 heures" },
  { value: "72", label: "72 heures (défaut)" },
  { value: "168", label: "7 jours" },
];

const NO_VALUE = "__none__";

type GeneratedLink = {
  token: string;
  url: string;
  expires_at: string;
};

interface GenerateTokenDialogProps {
  contacts: ContactOption[];
  companies: CompanyOption[];
}

function contactLabel(c: ContactOption): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (name && c.email) return `${name} · ${c.email}`;
  return name || c.email || "(sans nom)";
}

function contactFullName(c: ContactOption): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export function GenerateTokenDialog({
  contacts,
  companies,
}: GenerateTokenDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [hours, setHours] = useState("72");
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);

  const companiesById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  const reset = () => {
    setContactId("");
    setCompanyId("");
    setNom("");
    setEmail("");
    setEntreprise("");
    setHours("72");
    setGenerated(null);
    setCopied(false);
  };

  const handleContactChange = (v: string) => {
    if (v === NO_VALUE) {
      setContactId("");
      return;
    }
    setContactId(v);
    const c = contacts.find((x) => x.id === v);
    if (!c) return;

    // Auto-remplissage (champs restent éditables)
    const name = contactFullName(c);
    if (name) setNom(name);
    if (c.email) setEmail(c.email);
    if (c.company_id) {
      setCompanyId(c.company_id);
      const linkedCompany = companiesById.get(c.company_id);
      if (linkedCompany) setEntreprise(linkedCompany.name);
    }
  };

  const handleCompanyChange = (v: string) => {
    if (v === NO_VALUE) {
      setCompanyId("");
      return;
    }
    setCompanyId(v);
    const co = companiesById.get(v);
    if (co) setEntreprise(co.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/briefs/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_nom: nom.trim(),
          prospect_email: email.trim(),
          prospect_entreprise: entreprise.trim() || null,
          contact_id: contactId || null,
          company_id: companyId || null,
          expires_in_hours: Number(hours),
        }),
      });
      const json = (await res.json()) as
        | { token: string; url: string; expires_at: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Erreur");
        return;
      }
      setGenerated({
        token: json.token,
        url: json.url,
        expires_at: json.expires_at,
      });
      toast.success("Lien généré");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible");
    }
  };

  const expiresLabel = generated
    ? new Date(generated.expires_at).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Générer un lien
        </Button>
      </DialogTrigger>
      <DialogContent>
        {generated ? (
          <>
            <DialogHeader>
              <DialogTitle>Lien généré</DialogTitle>
              <DialogDescription>
                Envoie ce lien au prospect. Valable jusqu&apos;au {expiresLabel}.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 md:px-6 pb-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Lien
                </label>
                <div className="flex gap-2">
                  <Input
                    value={generated.url}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    title="Copier"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Token : <span className="font-mono">{generated.token}</span>
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset();
                }}
              >
                Générer un autre lien
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Générer un lien brief</DialogTitle>
              <DialogDescription>
                Sélectionne un contact / entreprise existant ou saisis un nouveau prospect.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 md:px-6 pb-4 space-y-4">
              {/* Pickers CRM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Contact CRM
                  </label>
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
                          {contactLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Entreprise CRM
                  </label>
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

              <p className="text-[11px] text-muted-foreground">
                Snapshot envoyé au prospect (modifiable) :
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Nom du prospect
                </label>
                <Input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="ex. Jean Dupont"
                  maxLength={200}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean@entreprise.fr"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Entreprise (optionnel)
                </label>
                <Input
                  value={entreprise}
                  onChange={(e) => setEntreprise(e.target.value)}
                  placeholder="ex. Acme SAS"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Durée d&apos;expiration
                </label>
                <Select value={hours} onValueChange={setHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting || !nom.trim() || !email.trim()}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Générer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
