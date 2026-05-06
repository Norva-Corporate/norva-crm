"use client";
import React, { useEffect, useState, useTransition } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  createCompany,
  updateCompany,
  type CompanyInput,
} from "@/lib/actions/contacts";
import type { Company } from "@/types";

const sizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"];
const NO_SIZE = "__none__";

interface CompanyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si fourni, on est en mode édition */
  company?: Company | null;
  /** Callback appelé après succès (avec l'id de la nouvelle entreprise en création) */
  onSuccess?: (id?: string) => void;
}

interface FormState {
  name: string;
  sector: string;
  domain: string;
  size: string;
  website: string;
  phone: string;
  address: string;
  notes: string;
}

const empty: FormState = {
  name: "",
  sector: "",
  domain: "",
  size: "",
  website: "",
  phone: "",
  address: "",
  notes: "",
};

export function CompanyDrawer({
  open,
  onOpenChange,
  company,
  onSuccess,
}: CompanyDrawerProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!company;

  useEffect(() => {
    if (open) {
      setError(null);
      if (company) {
        setForm({
          name: company.name,
          sector: company.sector ?? "",
          domain: company.domain ?? "",
          size: company.size ?? "",
          website: company.website ?? "",
          phone: company.phone ?? "",
          address: company.address ?? "",
          notes: company.notes ?? "",
        });
      } else {
        setForm(empty);
      }
    }
  }, [open, company]);

  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: CompanyInput = {
      name: form.name,
      sector: form.sector || null,
      domain: form.domain || null,
      size: form.size || null,
      website: form.website || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateCompany(company!.id, payload)
        : await createCompany(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.(isEdit ? undefined : result.data?.id);
    });
  }

  const canSubmit = form.name.trim().length > 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Modifier l'entreprise" : "Nouvelle entreprise"}
            </DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Mettez à jour les informations de l'entreprise."
                : "Ajoutez une nouvelle entreprise à votre CRM."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={field("name")}
                  placeholder="Acme Corp"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Secteur</Label>
                  <Input
                    value={form.sector}
                    onChange={field("sector")}
                    placeholder="Tech, Finance…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Domaine</Label>
                  <Input
                    value={form.domain}
                    onChange={field("domain")}
                    placeholder="acme.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Taille</Label>
                  <Select
                    value={form.size || NO_SIZE}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        size: v === NO_SIZE ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Effectif" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SIZE}>
                        <span className="text-muted-foreground">
                          Non renseignée
                        </span>
                      </SelectItem>
                      {sizeOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={form.phone}
                    onChange={field("phone")}
                    placeholder="+33 1 00 00 00 00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Site web</Label>
                <Input
                  value={form.website}
                  onChange={field("website")}
                  placeholder="https://acme.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <Input
                  value={form.address}
                  onChange={field("address")}
                  placeholder="1 rue Example, 75001 Paris"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={field("notes")}
                  placeholder="Notes internes…"
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer l'entreprise"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
