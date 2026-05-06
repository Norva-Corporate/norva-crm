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
  createContact,
  updateContact,
  type ContactInput,
} from "@/lib/actions/contacts";
import type { Contact } from "@/types";

interface ContactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si fourni, on est en mode édition */
  contact?: Contact | null;
  /** Liste des entreprises pour le select */
  companies: { id: string; name: string }[];
  /** Pré-sélection d'une entreprise (utilisé quand on crée depuis la fiche entreprise) */
  defaultCompanyId?: string;
  /** Callback appelé après succès (avec l'id du nouveau contact en création) */
  onSuccess?: (id?: string) => void;
}

const NO_COMPANY = "__none__";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  company_id: string;
  notes: string;
}

const empty: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "",
  company_id: "",
  notes: "",
};

export function ContactDrawer({
  open,
  onOpenChange,
  contact,
  companies,
  defaultCompanyId,
  onSuccess,
}: ContactDrawerProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!contact;

  useEffect(() => {
    if (open) {
      setError(null);
      if (contact) {
        setForm({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          role: contact.role ?? "",
          company_id: contact.company_id ?? "",
          notes: contact.notes ?? "",
        });
      } else {
        setForm({ ...empty, company_id: defaultCompanyId ?? "" });
      }
    }
  }, [open, contact, defaultCompanyId]);

  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: ContactInput = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role || null,
      company_id: form.company_id || null,
      notes: form.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateContact(contact!.id, payload)
        : await createContact(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.(isEdit ? undefined : result.data?.id);
    });
  }

  const canSubmit =
    form.first_name.trim().length > 0 && form.last_name.trim().length > 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Modifier le contact" : "Nouveau contact"}
            </DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Mettez à jour les informations du contact."
                : "Ajoutez un nouveau contact à votre CRM."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom *</Label>
                  <Input
                    value={form.first_name}
                    onChange={field("first_name")}
                    placeholder="Jean"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input
                    value={form.last_name}
                    onChange={field("last_name")}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={field("email")}
                  placeholder="jean@exemple.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={form.phone}
                    onChange={field("phone")}
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <Input
                    value={form.role}
                    onChange={field("role")}
                    placeholder="Directeur commercial"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Entreprise</Label>
                <Select
                  value={form.company_id || NO_COMPANY}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      company_id: v === NO_COMPANY ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une entreprise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>
                      <span className="text-muted-foreground">Aucune</span>
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {isEdit ? "Enregistrer" : "Créer le contact"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
