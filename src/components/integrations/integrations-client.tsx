"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, Unplug } from "lucide-react";

interface IntegrationActionsProps {
  isConnected: boolean;
}

export function IntegrationActions({ isConnected }: IntegrationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"resync" | "disconnect" | null>(
    null
  );

  if (!isConnected) {
    return (
      <Button asChild>
        <a href="/api/integrations/google/connect">
          Connecter Google Calendar + Drive
        </a>
      </Button>
    );
  }

  async function handleResync() {
    setBusyAction("resync");
    try {
      const res = await fetch("/api/integrations/google/resync", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Resync échoué : ${json.detail ?? json.error ?? "erreur"}`);
        return;
      }
      toast.success(
        `Resync OK : ${json.synced} événements synchronisés${
          json.errors > 0 ? `, ${json.errors} erreurs` : ""
        }`
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(`Resync échoué : ${(err as Error).message}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Déconnecter Google Calendar ? Les événements déjà créés dans le calendrier 'Norva CRM' resteront, mais ne seront plus mis à jour."
      )
    ) {
      return;
    }
    setBusyAction("disconnect");
    try {
      const res = await fetch("/api/integrations/google/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(`Déconnexion échouée : ${json.error ?? "erreur"}`);
        return;
      }
      toast.success("Google Calendar déconnecté.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(`Déconnexion échouée : ${(err as Error).message}`);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={handleResync}
        disabled={isPending || busyAction !== null}
      >
        <RefreshCw className="h-4 w-4" />
        {busyAction === "resync" ? "Synchronisation…" : "Resynchroniser tout"}
      </Button>
      <Button
        variant="outline"
        onClick={handleDisconnect}
        disabled={isPending || busyAction !== null}
      >
        <Unplug className="h-4 w-4" />
        {busyAction === "disconnect" ? "Déconnexion…" : "Déconnecter"}
      </Button>
    </div>
  );
}
