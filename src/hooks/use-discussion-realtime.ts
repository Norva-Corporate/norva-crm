"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DiscussionMessage } from "@/types";

type Handlers = {
  onInsert?: (message: DiscussionMessage) => void;
  onUpdate?: (message: DiscussionMessage) => void;
  onDelete?: (id: string) => void;
};

/**
 * Subscribe to a single channel's messages (parent thread + replies).
 * Reproduces the pattern from notification-bell.tsx.
 */
export function useDiscussionRealtime(
  channelId: string | null,
  handlers: Handlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`discussion:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "discussion_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            handlersRef.current.onInsert?.(payload.new as DiscussionMessage);
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as DiscussionMessage;
            if (next.deleted_at) {
              handlersRef.current.onDelete?.(next.id);
            } else {
              handlersRef.current.onUpdate?.(next);
            }
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
  }, [channelId]);
}

/**
 * Global subscription to all messages (used to update the sidebar
 * total unread badge). Returns nothing — caller wires handlers.
 */
export function useGlobalMessagesRealtime(
  onInsert: (message: DiscussionMessage) => void
) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("discussion:global")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "discussion_messages",
        },
        (payload) => {
          onInsertRef.current(payload.new as DiscussionMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
