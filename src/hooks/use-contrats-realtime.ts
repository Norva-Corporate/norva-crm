"use client";

import { useEffect, useId, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contrat } from "@/types";

type Scope =
  | { type: "deal"; id: string }
  | { type: "contact"; id: string }
  | { type: "all" };

type Handlers = {
  onInsert?: (contrat: Contrat) => void;
  onUpdate?: (contrat: Contrat) => void;
  onDelete?: (id: string) => void;
};

/**
 * Souscrit aux changements de la table `contrats` filtrée par scope.
 * Réutilise le pattern de `useDiscussionRealtime`.
 */
export function useContratsRealtime(scope: Scope, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    const channelName =
      scope.type === "all"
        ? `contrats:all:${instanceId}`
        : `contrats:${scope.type}:${scope.id}:${instanceId}`;

    const filter =
      scope.type === "deal"
        ? `deal_id=eq.${scope.id}`
        : scope.type === "contact"
        ? `contact_id=eq.${scope.id}`
        : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contrats",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            handlersRef.current.onInsert?.(payload.new as Contrat);
          } else if (payload.eventType === "UPDATE") {
            handlersRef.current.onUpdate?.(payload.new as Contrat);
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) handlersRef.current.onDelete?.(old.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.type === "all" ? "all" : scope.id, instanceId]);
}
