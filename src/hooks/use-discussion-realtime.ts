"use client";

import { useEffect, useId, useRef } from "react";
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
 *
 * Channel name carries a per-instance suffix so that several components
 * subscribing to the same channelId (e.g. MessageList + ThreadPanel) do
 * not collide on supabase-js's channel deduplication.
 */
export function useDiscussionRealtime(
  channelId: string | null,
  handlers: Handlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const instanceId = useId();

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`discussion:${channelId}:${instanceId}`)
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
  }, [channelId, instanceId]);
}

/**
 * Global subscription to all message inserts (used to update the sidebar
 * total unread badge). Per-instance suffix on the channel name avoids the
 * "cannot add postgres_changes after subscribe()" error when several hooks
 * mount simultaneously (Sidebar + ChannelSidebar both depend on it).
 */
export function useGlobalMessagesRealtime(
  onInsert: (message: DiscussionMessage) => void
) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`discussion:global:${instanceId}`)
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
  }, [instanceId]);
}
