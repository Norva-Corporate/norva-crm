"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDiscussionRealtime } from "@/hooks/use-discussion-realtime";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { markChannelRead } from "@/lib/actions/discussions";
import {
  DeletedMessageItem,
  MessageItem,
} from "@/components/discussion/message-item";
import type {
  DiscussionMessage,
  Profile,
} from "@/types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  channelId: string;
  channelName: string;
  initialMessages: DiscussionMessage[];
  currentUserId: string | null;
  onOpenThread?: (message: DiscussionMessage) => void;
  onUnreadReset?: () => void;
}

const SCROLL_THRESHOLD = 80;

function shouldGroupWithPrevious(
  current: DiscussionMessage,
  previous: DiscussionMessage | undefined
) {
  if (!previous) return false;
  if (previous.user_id !== current.user_id) return false;
  const prevTime = new Date(previous.created_at).getTime();
  const currTime = new Date(current.created_at).getTime();
  return currTime - prevTime < 5 * 60 * 1000;
}

export function MessageList({
  channelId,
  channelName,
  initialMessages,
  currentUserId,
  onOpenThread,
  onUnreadReset,
}: MessageListProps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>(initialMessages);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [showJump, setShowJump] = useState(false);
  const [pendingNew, setPendingNew] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const profileCacheRef = useRef<
    Map<string, Pick<Profile, "id" | "full_name" | "avatar_url" | "email">>
  >(new Map());
  const { notify, requestPermission } = useBrowserNotifications();

  // Reset state on channel switch
  useEffect(() => {
    setMessages(initialMessages);
    setPendingNew(0);
    setShowJump(false);
    isAtBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    void markChannelRead(channelId).then(() => onUnreadReset?.());
    void requestPermission();
  }, [channelId, initialMessages, onUnreadReset, requestPermission]);

  // Load thread counts initially
  useEffect(() => {
    const ids = initialMessages.map((m) => m.id);
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("discussion_messages")
        .select("parent_id, deleted_at")
        .in("parent_id", ids);
      if (cancelled || !data) return;
      const counts: Record<string, number> = {};
      for (const row of data) {
        if (row.deleted_at) continue; // count only active replies
        const pid = row.parent_id as string;
        counts[pid] = (counts[pid] ?? 0) + 1;
      }
      setThreadCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialMessages]);

  const fetchAuthor = useCallback(async (userId: string | null) => {
    if (!userId) return null;
    const cached = profileCacheRef.current.get(userId);
    if (cached) return cached;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      profileCacheRef.current.set(userId, data);
      return data as Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;
    }
    return null;
  }, []);

  useDiscussionRealtime(channelId, {
    onInsert: async (msg) => {
      // Skip threads from the main list
      if (msg.parent_id) {
        setThreadCounts((prev) => ({
          ...prev,
          [msg.parent_id as string]: (prev[msg.parent_id as string] ?? 0) + 1,
        }));
        return;
      }
      // Hydrate author if missing
      const author = msg.author ?? (await fetchAuthor(msg.user_id));
      const enriched = { ...msg, author } as DiscussionMessage;

      setMessages((prev) => {
        if (prev.some((m) => m.id === enriched.id)) return prev;
        return [...prev, enriched];
      });

      const isOwn = currentUserId && msg.user_id === currentUserId;
      if (!isOwn) {
        if (isAtBottomRef.current) {
          requestAnimationFrame(() => {
            const el = containerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
          void markChannelRead(channelId).then(() => onUnreadReset?.());
        } else {
          setPendingNew((n) => n + 1);
          setShowJump(true);
        }

        // Browser notification if mentioned
        const mentionedMe = msg.mentions?.some(
          (m) => m.type === "user" && m.id === currentUserId
        );
        if (mentionedMe) {
          notify(`${author?.full_name ?? "Mention"} dans #${channelName}`, {
            body: msg.content.slice(0, 120),
            icon: author?.avatar_url ?? undefined,
            onClick: () => {
              const el = document.querySelector<HTMLElement>(
                `[data-message-id="${msg.id}"]`
              );
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          });
        }
      } else {
        // own message — scroll
        requestAnimationFrame(() => {
          const el = containerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    },
    onUpdate: (msg) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, ...msg, author: m.author } : m))
      );
    },
    onDelete: (id) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m
        )
      );
    },
  });

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < SCROLL_THRESHOLD;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowJump(false);
      setPendingNew(0);
      void markChannelRead(channelId).then(() => onUnreadReset?.());
    }
  }, [channelId, onUnreadReset]);

  const jumpToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const grouped = useMemo(() => {
    return messages.map((m, i) => ({
      message: m,
      group: shouldGroupWithPrevious(m, messages[i - 1]),
    }));
  }, [messages]);

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4"
      >
        {grouped.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-foreground">
              Bienvenue dans #{channelName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aucun message pour le moment. Lance la conversation !
            </p>
          </div>
        ) : (
          grouped.map(({ message, group }) =>
            message.deleted_at ? (
              <DeletedMessageItem key={message.id} message={message} />
            ) : (
              <MessageItem
                key={message.id}
                message={message}
                currentUserId={currentUserId}
                isThreadParent
                threadCount={threadCounts[message.id] ?? 0}
                onOpenThread={onOpenThread}
                showAvatar={!group}
              />
            )
          )
        )}
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2",
            "inline-flex items-center gap-1.5 px-3 py-1.5",
            "bg-accent text-white text-xs font-medium rounded-full shadow-lg",
            "hover:bg-accent-hover transition-colors"
          )}
        >
          <ArrowDown className="h-3 w-3" />
          {pendingNew > 0 ? `${pendingNew} nouveau${pendingNew > 1 ? "x" : ""} message${pendingNew > 1 ? "s" : ""}` : "Nouveau message"}
        </button>
      )}
    </div>
  );
}
