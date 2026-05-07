"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGlobalMessagesRealtime } from "@/hooks/use-discussion-realtime";

interface UnreadState {
  total: number;
  perChannel: Record<string, number>;
  lastReadByChannel: Record<string, string>;
  userId: string | null;
}

const initialState: UnreadState = {
  total: 0,
  perChannel: {},
  lastReadByChannel: {},
  userId: null,
};

/**
 * Computes total unread messages across all channels for the current user.
 * Sums per-channel counts (messages by other users since last_read_at).
 * Updates live via Realtime on new messages.
 */
function useDiscussionUnread(): UnreadState & {
  reload: () => Promise<void>;
  markChannelLocal: (channelId: string) => void;
} {
  const [state, setState] = useState<UnreadState>(initialState);

  const load = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: channels }, { data: reads }] = await Promise.all([
      supabase.from("discussion_channels").select("id"),
      supabase
        .from("discussion_reads")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id),
    ]);

    const lastReadMap: Record<string, string> = {};
    for (const r of reads ?? []) {
      lastReadMap[r.channel_id as string] = r.last_read_at as string;
    }

    const channelIds = (channels ?? []).map((c) => c.id as string);
    const counts = await Promise.all(
      channelIds.map(async (id) => {
        const last = lastReadMap[id];
        const baseQuery = supabase
          .from("discussion_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", id)
          .is("deleted_at", null)
          .neq("user_id", user.id);
        const { count } = last
          ? await baseQuery.gt("created_at", last)
          : await baseQuery;
        return { id, count: count ?? 0 };
      })
    );

    const perChannel: Record<string, number> = {};
    let total = 0;
    for (const c of counts) {
      perChannel[c.id] = c.count;
      total += c.count;
    }

    setState({
      total,
      perChannel,
      lastReadByChannel: lastReadMap,
      userId: user.id,
    });
  };

  useEffect(() => {
    void load();
  }, []);

  // Realtime — increment counters on new messages from others
  useGlobalMessagesRealtime((message) => {
    setState((prev) => {
      if (!prev.userId) return prev;
      if (message.user_id === prev.userId) return prev;
      if (message.deleted_at) return prev;
      return {
        ...prev,
        total: prev.total + 1,
        perChannel: {
          ...prev.perChannel,
          [message.channel_id]: (prev.perChannel[message.channel_id] ?? 0) + 1,
        },
      };
    });
  });

  return {
    ...state,
    reload: load,
    markChannelLocal: (channelId: string) => {
      setState((prev) => {
        const wasUnread = prev.perChannel[channelId] ?? 0;
        if (wasUnread === 0) return prev;
        return {
          ...prev,
          total: Math.max(0, prev.total - wasUnread),
          perChannel: { ...prev.perChannel, [channelId]: 0 },
          lastReadByChannel: {
            ...prev.lastReadByChannel,
            [channelId]: new Date().toISOString(),
          },
        };
      });
    },
  };
}

/**
 * Lightweight hook for the sidebar — only the total count.
 * Polls the DB once on mount and listens to Realtime inserts.
 */
export function useDiscussionUnreadTotal(): number {
  const { total } = useDiscussionUnread();
  return total;
}

export { useDiscussionUnread };
