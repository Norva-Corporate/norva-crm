"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";
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
import { Loader2, Search, Trophy, Ban, Trash2, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import {
  createDeal,
  updateDeal,
  deleteDeal,
  markDealWon,
  markDealLost,
  type DealInput,
} from "@/lib/actions/deals";
import { getTagsForEntity } from "@/lib/actions/tags";
import { getFieldsWithValues } from "@/lib/actions/custom-fields";
import { EntityTags } from "@/components/tags/entity-tags";
import { CustomFieldsPanel } from "@/components/custom-fields/custom-fields-panel";
import { AgentButton } from "@/components/agents/agent-button";
import { Target } from "lucide-react";
import type {
  CustomFieldWithValue,
  DealStage,
  DealWithRelations,
  Tag,
} from "@/types";
import { STAGES } from "./stages";

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  company_id?: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
}

interface DealDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: DealWithRelations | null;
  defaultStage?: DealStage;
  contacts: ContactOption[];
  companies: { id: string; name: string }[];
  profiles: ProfileOption[];
  onSaved?: (deal: DealWithRelations, mode: "create" | "update") => void;
  onDeleted?: (id: string) => void;
  onStageChanged?: (id: string, stage: DealStage) => void;
}

const NONE = "__none__";

interface FormState {
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

const empty: FormState = {
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

export function DealDrawer({
  open,
  onOpenChange,
  deal,
  defaultStage,
  contacts,
  companies,
  profiles,
  onSaved,
  onDeleted,
  onStageChanged,
}: DealDrawerProps) {
  const isEdit = !!deal;
  const [form, setForm] = useState<FormState>(empty);
  const [contactQuery, setContactQuery] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [stagePending, startStageTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dealTags, setDealTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldWithValue[]>([]);

  // Load tags when drawer opens for an existing deal
  useEffect(() => {
    if (!open || !deal?.id) {
      setDealTags([]);
      setCustomFields([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getTagsForEntity("deal", deal.id),
      getFieldsWithValues("deal", deal.id),
    ]).then(([tags, fields]) => {
      if (cancelled) return;
      setDealTags(tags);
      setCustomFields(fields);
    });
    return () => {
      cancelled = true;
    };
  }, [open, deal?.id]);

  // Reset form on open / deal change
  useEffect(() => {
    if (!open) return;
    setError(null);
    setContactQuery("");
    setContactOpen(false);

    if (deal) {
      setForm({
        title: deal.title,
        value: deal.value != null ? deal.value.toString() : "",
        stage: deal.stage,
        probability:
          deal.probability != null ? deal.probability.toString() : "",
        expected_close_date: deal.expected_close_date ?? "",
        contact_id: deal.contact_id ?? "",
        company_id: deal.company_id ?? "",
        assigned_to: deal.assigned_to ?? "",
        notes: deal.notes ?? "",
      });
    } else {
      setForm({ ...empty, stage: defaultStage ?? "prospect" });
    }
  }, [open, deal, defaultStage]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === form.contact_id) ?? null,
    [contacts, form.contact_id]
  );

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    const list = q
      ? contacts.filter((c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
        )
      : contacts;
    return list.slice(0, 8);
  }, [contacts, contactQuery]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePickContact(c: ContactOption) {
    setForm((f) => ({
      ...f,
      contact_id: c.id,
      // si pas d'entreprise sélectionnée et que le contact a une boîte → préfill
      company_id: f.company_id || c.company_id || "",
    }));
    setContactQuery("");
    setContactOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: DealInput = {
      title: form.title.trim(),
      value: form.value ? parseFloat(form.value) : null,
      stage: form.stage,
      probability: form.probability ? parseInt(form.probability, 10) : null,
      expected_close_date: form.expected_close_date || null,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateDeal(deal!.id, payload)
        : await createDeal(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved?.(result.data, isEdit ? "update" : "create");
      onOpenChange(false);
    });
  }

  function handleStageShortcut(stage: DealStage) {
    if (!isEdit) {
      // En mode création, on change juste le state local du form.
      update("stage", stage);
      return;
    }
    setError(null);
    startStageTransition(async () => {
      const action = stage === "won" ? markDealWon : markDealLost;
      const result = await action(deal!.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onStageChanged?.(deal!.id, stage);
      update("stage", stage);
    });
  }

  function handleDelete() {
    if (!isEdit) return;
    if (!confirm(`Supprimer le deal « ${deal!.title} » ?`)) return;

    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteDeal(deal!.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDeleted?.(deal!.id);
      onOpenChange(false);
    });
  }

  const canSubmit = form.title.trim().length > 0;
  const isLocked = pending || stagePending || deletePending;

  return (
    <Drawer open={open} onOpenChange={(o) => !isLocked && onOpenChange(o)}>
      <DrawerContent className="sm:w-[520px]">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Modifier le deal" : "Nouveau deal"}
            </DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Mettez à jour les informations du deal."
                : "Ajoutez une nouvelle opportunité au pipeline."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-4">
              {/* Titre */}
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Refonte site web Acme"
                  autoFocus
                  required
                />
              </div>

              {/* Origine — lead converti */}
              {isEdit && deal?.source_lead && (
                <div className="flex items-start gap-2 px-2.5 py-2 bg-accent/5 border border-accent/20 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                      Lead d&apos;origine
                    </p>
                    <p className="text-foreground truncate">
                      {[
                        deal.source_lead.first_name,
                        deal.source_lead.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ") || "(Sans nom)"}
                      {deal.source_lead.company_name && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {deal.source_lead.company_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/leads"
                    className="text-accent hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    Voir
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Tags (édition uniquement) */}
              {isEdit && deal?.id && (
                <div className="space-y-1.5">
                  <Label>Tags</Label>
                  <EntityTags
                    entityType="deal"
                    entityId={deal.id}
                    initialTags={dealTags}
                  />
                </div>
              )}

              {/* Agents IA (édition uniquement) */}
              {isEdit && deal?.id && (
                <div className="space-y-1.5">
                  <Label>Agents IA</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <AgentButton
                      agent="rescoring-deal"
                      entityType="deal"
                      entityId={deal.id}
                      shortLabel="Re-scorer ce deal"
                      icon={Target}
                      successMessage="Re-scoring en file. Lance l'agent dans multica."
                    />
                  </div>
                </div>
              )}

              {/* Contact (autocomplete) */}
              <div className="space-y-1.5 relative">
                <Label>Contact</Label>
                {selectedContact ? (
                  <div className="flex items-center justify-between border border-[var(--border)] bg-[var(--surface)] px-3 h-9 text-sm">
                    <span className="text-foreground">
                      {selectedContact.first_name} {selectedContact.last_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => update("contact_id", "")}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Rechercher un contact…"
                      value={contactQuery}
                      onFocus={() => setContactOpen(true)}
                      onChange={(e) => {
                        setContactQuery(e.target.value);
                        setContactOpen(true);
                      }}
                      onBlur={() =>
                        // laisse le temps au click sur item
                        setTimeout(() => setContactOpen(false), 150)
                      }
                    />
                    {contactOpen && filteredContacts.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] shadow-card-hover max-h-60 overflow-y-auto">
                        {filteredContacts.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handlePickContact(c)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--muted)] text-foreground"
                          >
                            {c.first_name} {c.last_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Entreprise */}
              <div className="space-y-1.5">
                <Label>Entreprise</Label>
                <Select
                  value={form.company_id || NONE}
                  onValueChange={(v) =>
                    update("company_id", v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une entreprise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
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

              {/* Valeur + Probabilité */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valeur (€)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(e) => update("value", e.target.value)}
                    placeholder="5000"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Probabilité (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={(e) => update("probability", e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>

              {/* Stage + Closing date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Étape</Label>
                  <Select
                    value={form.stage}
                    onValueChange={(v) => update("stage", v as DealStage)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date de clôture</Label>
                  <Input
                    type="date"
                    value={form.expected_close_date}
                    onChange={(e) =>
                      update("expected_close_date", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Owner */}
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Select
                  value={form.assigned_to || NONE}
                  onValueChange={(v) =>
                    update("assigned_to", v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      <span className="text-muted-foreground">Non assigné</span>
                    </SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activité (notes libres) */}
              {isEdit && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <Label>Activité</Label>
                    {deal?.updated_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Maj : {formatDate(deal.updated_at)}
                      </span>
                    )}
                  </div>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={4}
                    placeholder="Appel, email, prochaine étape…"
                  />
                </div>
              )}

              {!isEdit && (
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={3}
                    placeholder="Notes internes…"
                  />
                </div>
              )}

              {isEdit && deal?.id && (
                <div className="pt-2 border-t border-[var(--border)] -mx-1">
                  <CustomFieldsPanel
                    entityType="deal"
                    entityId={deal.id}
                    initialFields={customFields}
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5">
                  {error}
                </p>
              )}

              {/* Raccourcis Won/Lost (édition uniquement) */}
              {isEdit && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStageShortcut("won")}
                    disabled={isLocked || form.stage === "won"}
                    className={cn(
                      "border-[#22C55E]/30 text-[#4ADE80] hover:bg-[#22C55E]/10 hover:text-[#4ADE80]",
                      form.stage === "won" && "bg-[#22C55E]/15"
                    )}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Marquer gagné
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStageShortcut("lost")}
                    disabled={isLocked || form.stage === "lost"}
                    className={cn(
                      "border-[#EF4444]/30 text-[#F87171] hover:bg-[#EF4444]/10 hover:text-[#F87171]",
                      form.stage === "lost" && "bg-[#EF4444]/15"
                    )}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Marquer perdu
                  </Button>
                </div>
              )}

              {/* Suppression (édition uniquement) */}
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLocked}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer ce deal
                </button>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLocked}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit || isLocked}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer le deal"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
