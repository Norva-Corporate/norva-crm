"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, X, ChevronDown, ChevronUp, Wifi, WifiOff, Settings } from "lucide-react";
import { getAuthUrl } from "@/lib/gmail-client";
import {
  validateAndSendCampaign,
  rejectCampaign,
  updateProspectionSetting,
  type EmailCampaign,
  type EmailVariant,
} from "@/lib/actions/campagnes";
import { cn } from "@/lib/utils";

interface Props {
  campaigns: EmailCampaign[];
  settings: Record<string, string>;
}

export function CampagnesClient({ campaigns: initialCampaigns, settings }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialCampaigns[0]?.id ?? null
  );
  const [editedVariants, setEditedVariants] = useState<Record<string, EmailVariant>>({});
  const [selectedVariantKey, setSelectedVariantKey] = useState<Record<string, "variant_1" | "variant_2" | "variant_3">>({});
  const [isPending, startTransition] = useTransition();
  const [sendHour, setSendHour] = useState(settings.send_hour ?? "09");
  const [maxPerDay, setMaxPerDay] = useState(settings.max_per_day ?? "10");
  const [showSettings, setShowSettings] = useState(false);

  const isConnected = !!settings.gmail_refresh_token;

  function getVariant(campaign: EmailCampaign, key: "variant_1" | "variant_2" | "variant_3"): EmailVariant {
    const editKey = `${campaign.id}_${key}`;
    return editedVariants[editKey] ?? campaign[key];
  }

  function handleEditVariant(campaignId: string, variantKey: string, field: keyof EmailVariant, value: string) {
    const editKey = `${campaignId}_${variantKey}`;
    const campaign = campaigns.find((c) => c.id === campaignId)!;
    const current = editedVariants[editKey] ?? campaign[variantKey as keyof EmailCampaign] as EmailVariant;
    setEditedVariants((prev) => ({
      ...prev,
      [editKey]: { ...current, [field]: value },
    }));
  }

  function handleSend(campaign: EmailCampaign) {
    const variantKey = selectedVariantKey[campaign.id] ?? "variant_1";
    const variant = getVariant(campaign, variantKey);

    startTransition(async () => {
      const result = await validateAndSendCampaign(campaign.id, variant);
      if (result.success) {
        toast.success("Email envoyé !");
        setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject(campaignId: string) {
    startTransition(async () => {
      await rejectCampaign(campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      toast.info("Email rejeté");
    });
  }

  function handleSaveSettings() {
    startTransition(async () => {
      await updateProspectionSetting("send_hour", sendHour);
      await updateProspectionSetting("max_per_day", maxPerDay);
      toast.success("Paramètres sauvegardés");
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Gmail connection banner */}
      {!isConnected && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <WifiOff className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-300 flex-1">
            Gmail non connecté — les emails ne pourront pas être envoyés.
          </p>
          <a
            href="/api/auth/gmail/connect"
            className="text-xs font-medium text-yellow-300 underline hover:text-yellow-100"
          >
            Connecter Gmail
          </a>
        </div>
      )}

      {isConnected && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Wifi className="h-3.5 w-3.5" />
          Gmail connecté (norvagroupe@gmail.com)
        </div>
      )}

      {/* Settings panel */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Paramètres de la routine
          {showSettings ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </button>
        {showSettings && (
          <div className="border-t border-border px-4 pb-4 pt-3 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Heure d&apos;envoi</label>
              <select
                value={sendHour}
                onChange={(e) => setSendHour(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
              >
                {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={String(h).padStart(2, "0")}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Emails max / jour</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-20"
              />
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent/80 disabled:opacity-50"
            >
              Sauvegarder
            </button>
          </div>
        )}
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Send className="h-8 w-8 mb-3 opacity-30" />
          <p className="text-sm">Aucun email en attente de validation</p>
          <p className="text-xs mt-1 opacity-60">La routine génère automatiquement de nouveaux emails chaque jour</p>
        </div>
      )}

      {campaigns.map((campaign) => {
        const snapshot = campaign.lead_snapshot as Record<string, unknown>;
        const isExpanded = expandedId === campaign.id;
        const variantKey = selectedVariantKey[campaign.id] ?? "variant_1";
        const variantLabels = {
          variant_1: campaign.variant_1.tone,
          variant_2: campaign.variant_2.tone,
          variant_3: campaign.variant_3.tone,
        };

        return (
          <div key={campaign.id} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {(snapshot.company_name as string) ?? "Entreprise inconnue"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(snapshot.first_name as string) ?? ""} {(snapshot.last_name as string) ?? ""}{" "}
                  {snapshot.email ? `· ${snapshot.email}` : ""}
                </p>
                {!!snapshot.google_info && (
                  <p className="text-xs text-emerald-400/70 mt-0.5">{snapshot.google_info as string}</p>
                )}
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Variant selector */}
                <div className="flex gap-2">
                  {(["variant_1", "variant_2", "variant_3"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedVariantKey((prev) => ({ ...prev, [campaign.id]: key }))}
                      className={cn(
                        "flex-1 text-xs px-2 py-1.5 rounded border transition-colors",
                        variantKey === key
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border text-muted-foreground hover:border-accent/50"
                      )}
                    >
                      {variantLabels[key]}
                    </button>
                  ))}
                </div>

                {/* Email editor */}
                {(["variant_1", "variant_2", "variant_3"] as const).map((key) => {
                  if (key !== variantKey) return null;
                  const variant = getVariant(campaign, key);
                  return (
                    <div key={key} className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Objet</label>
                        <input
                          value={variant.subject}
                          onChange={(e) => handleEditVariant(campaign.id, key, "subject", e.target.value)}
                          className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Corps de l&apos;email</label>
                        <textarea
                          value={variant.body}
                          onChange={(e) => handleEditVariant(campaign.id, key, "body", e.target.value)}
                          rows={10}
                          className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent resize-y font-mono"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSend(campaign)}
                    disabled={isPending || !isConnected}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-white rounded hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Envoyer cet email
                  </button>
                  <button
                    onClick={() => handleReject(campaign.id)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Rejeter
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
