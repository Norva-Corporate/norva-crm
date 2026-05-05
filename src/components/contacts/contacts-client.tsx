"use client";
import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Mail, Phone, Building2, Loader2, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInitials, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Contact, ContactWithRelations } from "@/types";

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  company_id: string;
  notes: string;
}

const defaultForm: ContactFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  job_title: "",
  company_id: "",
  notes: "",
};

interface Props {
  initialContacts: any[];
  companies: { id: string; name: string }[];
}

export function ContactsClient({ initialContacts, companies }: Props) {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ContactFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const q = search.toLowerCase();
        return (
          !q ||
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.name?.toLowerCase().includes(q)
        );
      }),
    [contacts, search]
  );

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setIsOpen(true);
  }

  function openEdit(contact: any) {
    setEditing(contact);
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      job_title: contact.job_title ?? "",
      company_id: contact.company_id ?? "",
      notes: contact.notes ?? "",
    });
    setIsOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const payload = {
      ...form,
      company_id: form.company_id || null,
      email: form.email || null,
      phone: form.phone || null,
      job_title: form.job_title || null,
      notes: form.notes || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", editing.id)
        .select("*, company:companies(id, name)")
        .single();
      if (!error && data) {
        setContacts((prev) => prev.map((c) => (c.id === editing.id ? data : c)));
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...payload, created_by: user!.id })
        .select("*, company:companies(id, name)")
        .single();
      if (!error && data) {
        setContacts((prev) => [data, ...prev]);
      }
    }

    setLoading(false);
    setIsOpen(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteId(null);
  }

  return (
    <>
      <Header
        title="Contacts"
        action={{ label: "Nouveau contact", onClick: openCreate }}
      />

      <div className="flex-1 p-6 animate-fade-in">
        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} contact(s)</span>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Téléphone</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Entreprise</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ajouté le</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aucun contact trouvé.{" "}
                      <button onClick={openCreate} className="text-accent hover:underline">
                        Créer le premier
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(`${contact.first_name} ${contact.last_name}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {contact.first_name} {contact.last_name}
                            </p>
                            {contact.job_title && (
                              <p className="text-xs text-muted-foreground">{contact.job_title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground">
                          {contact.phone ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {contact.company ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-foreground">{contact.company.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(contact.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(contact)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(contact.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prénom *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jean@exemple.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+33 6 00 00 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Poste</Label>
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                  placeholder="Directeur commercial"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Entreprise</Label>
              <Select
                value={form.company_id}
                onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune</SelectItem>
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
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes internes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !form.first_name || !form.last_name}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le contact</DialogTitle>
          </DialogHeader>
          <p className="px-6 pb-2 text-sm text-muted-foreground">
            Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
