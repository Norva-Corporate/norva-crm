"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDiscussionRealtime } from "@/hooks/use-discussion-realtime";
import {
  DeletedMessageItem,
  MessageItem,
} from "@/components/discussion/message-item";
import { MessageComposer } from "@/components/discussion/message-composer";
import type { DiscussionMessage } from "@/types";

interface MessageThreadPanelProps {
  channelId: string;
  parent: DiscussionMessage;
  currentUserId: string | null;
  onClose: () => void;
}

export function MessageThreadPanel({
  channelId,
  parent,
  currentUserId,
  onClose,
}: MessageThreadPanelProps) {
  const [replies, setReplies] = useState<DiscussionMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("discussion_messages")
        .select(
          `*, author:profiles!discussion_messages_user_id_fkey(id, full_name, avatar_url, email)`
        )
        .eq("parent_id", parent.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setReplies((data ?? []) as DiscussionMessage[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [parent.id]);

  // Subscribe to thread updates (same channel filter, then filter parent_id)
  useDiscussionRealtime(channelId, {
    onInsert: (msg) => {
      if (msg.parent_id !== parent.id) return;
      setReplies((prev) =>
        prev.some((r) => r.id === msg.id) ? prev : [...prev, msg]
      );
    },
    onUpdate: (msg) => {
      if (msg.parent_id !== parent.id) return;
      setReplies((prev) =>
        prev.map((r) => (r.id === msg.id ? { ...r, ...msg } : r))
      );
    },
    onDelete: (id) => {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r
        )
      );
    },
  });

  return (
    <aside className="hidden lg:flex w-[400px] flex-col bg-[var(--card)] border-l border-[var(--border)]">
      <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--border)]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Thread</h3>
          <p className="text-[11px] text-muted-foreground">
            {replies.length} {replies.length > 1 ? "réponses" : "réponse"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)]"
          aria-label="Fermer le thread"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--border)] py-2">
          {parent.deleted_at ? (
            <DeletedMessageItem message={parent} />
          ) : (
            <MessageItem
              message={parent}
              currentUserId={currentUserId}
            />
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-2">
            {replies.map((r) =>
              r.deleted_at ? (
                <DeletedMessageItem key={r.id} message={r} />
              ) : (
                <MessageItem
                  key={r.id}
                  message={r}
                  currentUserId={currentUserId}
                />
              )
            )}
          </div>
        )}
      </div>

      <MessageComposer
        channelId={channelId}
        parentId={parent.id}
        placeholder="Réponse au thread…"
      />
    </aside>
  );
}
