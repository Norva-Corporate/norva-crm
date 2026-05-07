"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDiscussionUnread } from "@/hooks/use-unread-counts";
import { ChannelCreateDialog } from "@/components/discussion/channel-create-dialog";
import { ChannelSettingsDialog } from "@/components/discussion/channel-settings-dialog";
import { cn } from "@/lib/utils";
import type { DiscussionChannel } from "@/types";

interface ChannelSidebarProps {
  channels: DiscussionChannel[];
  activeChannelId: string | null;
  isAdmin: boolean;
}

export function ChannelSidebar({
  channels: initialChannels,
  activeChannelId,
  isAdmin,
}: ChannelSidebarProps) {
  const [channels, setChannels] = useState(initialChannels);
  const { perChannel } = useDiscussionUnread();

  // Sync local channels list with realtime channel inserts/deletes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("discussion:channels-meta")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discussion_channels" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const c = payload.new as DiscussionChannel;
            setChannels((prev) =>
              prev.some((x) => x.id === c.id) ? prev : [...prev, c]
            );
          } else if (payload.eventType === "UPDATE") {
            const c = payload.new as DiscussionChannel;
            setChannels((prev) =>
              prev.map((x) => (x.id === c.id ? { ...x, ...c } : x))
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id)
              setChannels((prev) => prev.filter((x) => x.id !== old.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <aside className="hidden md:flex w-60 flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)]">
      <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--sidebar-border)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
          Canaux
        </h2>
        <ChannelCreateDialog />
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {channels.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">
            Aucun canal. Créez-en un pour commencer.
          </p>
        ) : (
          <ul>
            {channels.map((c) => {
              const isActive = c.id === activeChannelId;
              const unread = perChannel[c.id] ?? 0;
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/dashboard/discussion/${c.id}`}
                    className={cn(
                      "flex items-center gap-2 h-8 px-3 text-sm transition-colors",
                      isActive
                        ? "bg-accent/15 text-accent border-l-2 border-accent"
                        : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5 border-l-2 border-transparent"
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        unread > 0 && !isActive && "font-semibold text-foreground"
                      )}
                    >
                      {c.name}
                    </span>
                    {unread > 0 && !isActive && (
                      <span className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center text-[10px] font-semibold bg-accent text-white rounded-full">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                  {isActive && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <ChannelSettingsDialog channel={c} isAdmin={isAdmin} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
