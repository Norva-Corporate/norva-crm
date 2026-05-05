"use client";
import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
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
import { MoreHorizontal, Loader2, Pencil, Trash2, TrendingUp, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DealStage } from "@/types";

const STAGES: { key: DealStage; label: string; color: string; accent: string }[] = [
  { key: "prospect", label: "Prospect", color: "border-t-[#6366F1]", accent: "#818CF8" },
  { key: "qualified", label: "Qualifié", color: "border-t-[#3B82F6]", accent: "#60A5FA" },
  { key: "proposal", label: "Devis", color: "border-t-[#F59E0B]", accent: "#FCD34D" },
  { key: "negotiation", label: "Négociation", color: "border-t-[#F97316]", accent: "#FB923C" },
  { key: "won", label: "Gagné", color: "border-t-[#22C55E]", accent: "#4ADE80" },
  { key: "lost", label: "Perdu", color: "border-t-[#EF4444]", accent: "#F87171" },
];

interface DealForm {
  title: string;
  value: string;
  stage: DealStage;
  probability: string;
  expected_close_date: string;
  contact_id: string;
  company_id: string;
  assigned_to: string;
  notes: string;
}

const defaultForm: DealForm = {
  title: "",
  value: "",
  stage: "prospect",
  probability: "",
  expected_close_date: "",
  contact_id: "",
  company_id: "",
  assigned_to: "",
  notes: "",
};

interface Props {
  initialDeals: any[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  profiles: { id: string; full_name: string | null }[];
}

export function PipelineClient({ initialDeals, contacts, companies, profiles }: Props) {
  const [deals, setDeals] = useState<any[]>(initialDeals);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<DealForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const dealsByStage = useMemo(
    () =>
      STAGES.reduce((acc, s) => {
        acc[s.key] = deals.filter((d) => d.stage === s.key);
        return acc;
      }, {} as Record<DealStage, any[]>),
    [deals]
  );

  const stageTotal = (stage: DealStage) =>
    dealsByStage[stage].reduce((s, d) => s + (d.value ?? 0), 0);

  function openCreate(stage: DealStage = "prospect") {
    setEditing(null);
    setForm({ ...defaultForm, stage });
    setIsOpen(true);
  }

  function openEdit(deal: any) {
    setEditing(deal);
    setForm({
      title: deal.title,
      value: deal.value?.toString() ?? "",
      stage: deal.stage,
      probability: deal.probability?.toString() ?? "",
      expected_close_date: deal.expected_close_date ?? "",
      contact_id: deal.contact_id ?? "",
      company_id: deal.company_id ?? "",
      assigned_to: deal.assigned_to ?? "",
      notes: deal.notes ?? "",
    });
    setIsOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const payload = {
      title: form.title,
      value: form.value ? parseFloat(form.value) : null,
      stage: form.stage,
      probability: form.probability ? parseInt(form.probability) : null,
      expected_close_date: form.expected_close_date || null,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", editing.id)
        .select("*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles(id, full_name)")
        .single();
      if (!error && data) setDeals((prev) => prev.map((d) => (d.id === editing.id ? data : d)));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("deals")
        .insert({ ...payload, created_by: user!.id, stage_order: dealsByStage[form.stage].length })
        .select("*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles(id, full_name)")
        .single();
      if (!error && data) setDeals((prev) => [...prev, data]);
    }

    setLoading(false);
    setIsOpen(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("deals").delete().eq("id", id);
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setDeleteId(null);
  }

  async function handleDrop(e: React.DragEvent, targetStage: DealStage) {
    e.preventDefault();
    if (!dragging) return;
    const dealId = dragging;
    setDragging(null);
    if (deals.find((d) => d.id === dealId)?.stage === targetStage) return;

    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d))
    );

    const supabase = createClient();
    await supabase
      .from("deals")
      .update({ stage: targetStage })
      .eq("id", dealId);
  }

  return (
    <>
      <Header title="Pipeline" action={{ label: "Nouveau deal", onClick: () => openCreate() }} />

      <div className="flex-1 p-6 overflow-x-auto animate-fade-in">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => (
            <div
              key={stage.key}
              className="w-64 flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className={`bg-[var(--card)] border border-[var(--border)] border-t-2 ${stage.color} p-3 mb-2`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-foreground">{stage.label}</h3>
                  <span
                    className="text-xs font-medium px-1.5 py-0.5"
                    style={{ color: stage.accent, background: `${stage.accent}20` }}
                  >
                    {dealsByStage[stage.key].length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stageTotal(stage.key) > 0 ? formatCurrency(stageTotal(stage.key)) : "—"}
                </p>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2">
                {dealsByStage[stage.key].map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`bg-[var(--card)] border border-[var(--border)] p-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover hover:border-accent/30 transition-all group ${
                      dragging === deal.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-foreground leading-tight flex-1">
                        {deal.title}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 shrink-0 h-6 w-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(deal)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(deal.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {deal.value && (
                      <p className="text-sm font-bold text-foreground mb-2">
                        {formatCurrency(deal.value)}
                      </p>
                    )}

                    <div className="space-y-1">
                      {deal.contact && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {deal.contact.first_name} {deal.contact.last_name}
                        </p>
                      )}
                      {!deal.contact && deal.company && (
                        <p className="text-xs text-muted-foreground">{deal.company.name}</p>
                      )}
                      {deal.expected_close_date && (
                        <p className="text-[10px] text-muted-foreground">
                          Clôture : {formatDate(deal.expected_close_date)}
                        </p>
                      )}
                      {deal.probability != null && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1 bg-[var(--muted)]">
                            <div
                              className="h-full bg-accent transition-all"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{deal.probability}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => openCreate(stage.key)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-accent border border-dashed border-[var(--border)] hover:border-accent/40 transition-colors"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Form Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le deal" : "Nouveau deal"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Refonte site web Acme"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valeur (€)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Probabilité (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Étape</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v as DealStage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date de clôture estimée</Label>
              <Input
                type="date"
                value={form.expected_close_date}
                onChange={(e) => setForm((f) => ({ ...f, expected_close_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm((f) => ({ ...f, contact_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entreprise</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non assigné</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading || !form.title}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer le deal</DialogTitle></DialogHeader>
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
