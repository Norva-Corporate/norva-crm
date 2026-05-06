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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { convertLead } from "@/lib/actions/leads";
import type { LeadWithDedup } from "@/lib/actions/leads";

const NEW_COMPANY = "__new__";
const NO_COMPANY = "__none__";

interface Props {
  lead: LeadWithDedup | null;
  companies: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConvertLeadDrawer({
  lead,
  companies,
  onOpenChange,
  onSuccess,
}: Props) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [companyChoice, setCompanyChoice] = useState<string>(NO_COMPANY);
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    setError(null);
    setFirst(lead.first_name ?? "");
    setLast(lead.last_name ?? "");
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setRole(lead.role ?? "");
    if (lead.existing_company_id) {
      setCompanyChoice(lead.existing_company_id);
      setCompanyName("");
      setCompanyDomain("");
    } else if (lead.company_name || lead.company_domain) {
      setCompanyChoice(NEW_COMPANY);
      setCompanyName(lead.company_name ?? "");
      setCompanyDomain(lead.company_domain ?? "");
    } else {
      setCompanyChoice(NO_COMPANY);
      setCompanyName("");
      setCompanyDomain("");
    }
  }, [lead]);

  if (!lead) {
    return (
      <Drawer open={false} onOpenChange={() => onOpenChange(false)}>
        <DrawerContent />
      </Drawer>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setError(null);
    startTransition(async () => {
      const overrides: Parameters<typeof convertLead>[1] = {
        first_name: first,
        last_name: last,
        email: email || undefined,
        phone: phone || undefined,
        role: role || undefined,
      };
      if (companyChoice === NO_COMPANY) {
        overrides.company_id = null;
      } else if (companyChoice === NEW_COMPANY) {
        overrides.company_id = null;
        overrides.company_name = companyName;
        overrides.company_domain = companyDomain;
      } else {
        overrides.company_id = companyChoice;
      }
      const res = await convertLead(lead.id, overrides);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess?.();
    });
  }

  return (
    <Drawer
      open={!!lead}
      onOpenChange={(o) => !pending && onOpenChange(o)}
    >
      <DrawerContent>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Convertir le lead
            </DrawerTitle>
            <DrawerDescription>
              Crée un contact (et optionnellement une entreprise) à partir du
              lead.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first">Prénom *</Label>
                <Input
                  id="first"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last">Nom *</Label>
                <Input
                  id="last"
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Fonction</Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Entreprise</Label>
              <Select value={companyChoice} onValueChange={setCompanyChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>Aucune</SelectItem>
                  <SelectItem value={NEW_COMPANY}>
                    Créer une nouvelle entreprise
                  </SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {companyChoice === NEW_COMPANY && (
              <div className="grid grid-cols-1 gap-3 pl-3 border-l-2 border-accent/30">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Nom *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyDomain">Domaine</Label>
                  <Input
                    id="companyDomain"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="acme.com"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                {error}
              </p>
            )}
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Convertir
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
