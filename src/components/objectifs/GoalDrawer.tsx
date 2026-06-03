"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveDrawer,
  ResponsiveDrawerHeader as DrawerHeader,
  ResponsiveDrawerBody as DrawerBody,
  ResponsiveDrawerFooter as DrawerFooter,
  ResponsiveDrawerTitle as DrawerTitle,
} from "@/components/ui/responsive-drawer";
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
import {
  createGoal,
  updateGoal,
  type GoalMetric,
  type GoalPeriod,
  type GoalScope,
  type GoalWithProgress,
} from "@/lib/actions/goals";

const METRICS: { value: GoalMetric; label: string }[] = [
  { value: "deals_won", label: "Nombre de deals gagnés" },
  { value: "revenue_collected", label: "Revenu encaissé (€)" },
  { value: "leads_qualified", label: "Leads qualifiés" },
];

const PERIODS: { value: GoalPeriod; label: string }[] = [
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année" },
];

/**
 * Aide à pré-remplir period_start/period_end selon period_type sélectionné.
 * Mois → 1er du mois en cours → dernier jour du mois en cours, etc.
 */
function suggestDates(period: GoalPeriod): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === "week") {
    const day = now.getDay() || 7; // dimanche=0 → 7
    start = new Date(now);
    start.setDate(now.getDate() - (day - 1));
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), q * 3, 1);
    end = new Date(now.getFullYear(), q * 3 + 3, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  }
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export function GoalDrawer({
  open,
  onOpenChange,
  goal,
  profiles,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalWithProgress | null;
  profiles: { id: string; full_name: string | null; email: string | null }[];
  onSuccess?: () => void;
}) {
  const [scope, setScope] = useState<GoalScope>("team");
  const [ownerId, setOwnerId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<GoalMetric>("deals_won");
  const [targetValue, setTargetValue] = useState("10");
  const [periodType, setPeriodType] = useState<GoalPeriod>("month");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setScope(goal.scope);
      setOwnerId(goal.owner_profile_id ?? "");
      setTitle(goal.title);
      setDescription(goal.description ?? "");
      setMetric(goal.metric_type);
      setTargetValue(String(goal.target_value));
      setPeriodType(goal.period_type);
      setPeriodStart(goal.period_start);
      setPeriodEnd(goal.period_end);
    } else {
      setScope("team");
      setOwnerId("");
      setTitle("");
      setDescription("");
      setMetric("deals_won");
      setTargetValue("10");
      setPeriodType("month");
      const dates = suggestDates("month");
      setPeriodStart(dates.start);
      setPeriodEnd(dates.end);
    }
  }, [open, goal]);

  function handlePeriodTypeChange(v: string) {
    const p = v as GoalPeriod;
    setPeriodType(p);
    if (!goal) {
      // Auto-suggest dates seulement en création (pas en édition).
      const dates = suggestDates(p);
      setPeriodStart(dates.start);
      setPeriodEnd(dates.end);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    if (scope === "individual" && !ownerId) {
      toast.error("Sélectionne un membre pour un objectif individuel.");
      return;
    }
    const target = Number(targetValue);
    if (!target || target <= 0) {
      toast.error("La valeur cible doit être > 0.");
      return;
    }

    startTransition(async () => {
      const payload = {
        scope,
        owner_profile_id: scope === "team" ? null : ownerId,
        title: title.trim(),
        description: description.trim() || null,
        metric_type: metric,
        target_value: target,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
      };
      const res = goal
        ? await updateGoal(goal.id, payload)
        : await createGoal(payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(goal ? "Objectif modifié." : "Objectif créé.");
      onSuccess?.();
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[520px]"
    >
        <DrawerHeader>
          <DrawerTitle>
            {goal ? "Modifier l'objectif" : "Nouvel objectif"}
          </DrawerTitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="space-y-4">
            <div>
              <Label htmlFor="scope">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as GoalScope)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Équipe (partagé)</SelectItem>
                  <SelectItem value="individual">Individuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "individual" && (
              <div>
                <Label htmlFor="owner">Membre</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="owner">
                    <SelectValue placeholder="Sélectionner un membre…" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 10 deals gagnés en mars"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description (facultatif)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="metric">Métrique</Label>
                <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
                  <SelectTrigger id="metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="target">Valeur cible</Label>
                <Input
                  id="target"
                  type="number"
                  min="0"
                  step={metric === "revenue_collected" ? "100" : "1"}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="periodType">Type de période</Label>
              <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                <SelectTrigger id="periodType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="periodStart">Début</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">Fin</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {metric === "revenue_collected" && scope === "individual" && (
              <p className="text-[11px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2 py-1.5">
                Note : le revenu n'est pas encore par-membre. Pour l'instant
                le total team sera comptabilisé. À étendre v2.
              </p>
            )}
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {goal ? "Enregistrer" : "Créer"}
            </Button>
          </DrawerFooter>
        </form>
    </ResponsiveDrawer>
  );
}
