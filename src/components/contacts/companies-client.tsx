"use client";
import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Globe, Phone, Building2, Loader2, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Company } from "@/types";

interface CompanyFormData {
  name: string;
  domain: string;
  industry: string;
  size: string;
  website: string;
  phone: string;
  address: string;
  notes: string;
}

const defaultForm: CompanyFormData = {
  name: "",
  domain: "",
  industry: "",
  size: "",
  website: "",
  phone: "",
  address: "",
  notes: "",
};

const sizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"];

export function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      companies.filter((c) => {
        const q = search.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q);
      }),
    [companies, search]
  );

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setIsOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setForm({
      name: company.name,
      domain: company.domain ?? "",
      industry: company.industry ?? "",
      size: company.size ?? "",
      website: company.website ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
      notes: company.notes ?? "",
    });
    setIsOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const payload = {
      ...form,
      domain: form.domain || null,
      industry: form.industry || null,
      size: form.size || null,
      website: form.website || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      if (!error && data) setCompanies((prev) => prev.map((c) => (c.id === editing.id ? data : c)));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("companies")
        .insert({ ...payload, created_by: user!.id })
        .select()
        .single();
      if (!error && data) setCompanies((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }

    setLoading(false);
    setIsOpen(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("companies").delete().eq("id", id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  return (
    <>
      <Header title="Entreprises" action={{ label: "Nouvelle entreprise", onClick: openCreate }} />

      <div className="flex-1 p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher une entreprise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} entreprise(s)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Aucune entreprise trouvée.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">Créer la première</button>
            </div>
          ) : (
            filtered.map((company) => (
              <Card key={company.id} className="p-4 hover:shadow-card-hover transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 bg-accent/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{company.name}</p>
                      {company.industry && (
                        <p className="text-xs text-muted-foreground">{company.industry}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(company)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(company.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1.5">
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                    >
                      <Globe className="h-3 w-3" />
                      {company.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {company.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {company.phone}
                    </p>
                  )}
                  {company.size && (
                    <p className="text-xs text-muted-foreground">{company.size} employés</p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'entreprise" : "Nouvelle entreprise"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Domaine</Label>
                <Input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} placeholder="acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Secteur</Label>
                <Input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="Tech, Finance..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Taille</Label>
                <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
                  <SelectTrigger><SelectValue placeholder="Effectif" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Non renseigné</SelectItem>
                    {sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+33 1 00 00 00 00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Site web</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="1 rue Example, Paris" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading || !form.name}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer l'entreprise</DialogTitle></DialogHeader>
          <p className="px-6 pb-2 text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
