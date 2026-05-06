"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CheckSquare,
  Kanban,
  CircleDollarSign,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { Notification } from "@/types";

const TYPE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  task_assigned: CheckSquare,
  deal_assigned: Kanban,
  invoice_paid: CircleDollarSign,
};

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load initial state + subscribe
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);

      const { data: rows } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;

      const list = rows ?? [];
      setItems(list);
      setUnread(list.filter((n) => !n.read_at).length);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          if (!n.read_at) setUnread((u) => u + 1);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  const handleClickItem = useCallback(
    async (n: Notification) => {
      if (!n.read_at) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === n.id
              ? { ...it, read_at: new Date().toISOString() }
              : it
          )
        );
        setUnread((u) => Math.max(0, u - 1));
        await markNotificationRead(n.id);
      }
      setOpen(false);
      if (n.link) router.push(n.link);
    },
    [router]
  );

  const handleMarkAll = useCallback(async () => {
    if (unread === 0) return;
    setItems((prev) =>
      prev.map((it) =>
        it.read_at ? it : { ...it, read_at: new Date().toISOString() }
      )
    );
    setUnread(0);
    await markAllNotificationsRead();
  }, [unread]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 flex items-center justify-center text-[9px] font-semibold bg-destructive text-white rounded-full">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 bg-[var(--card)] border border-[var(--border)]"
      >
        <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <button
            onClick={handleMarkAll}
            disabled={unread === 0}
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              unread === 0
                ? "text-muted-foreground cursor-default"
                : "text-accent hover:text-accent-hover"
            )}
          >
            <CheckCheck className="h-3 w-3" />
            Tout marquer lu
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Aucune notification.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const isUnread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickItem(n)}
                      className={cn(
                        "w-full text-left flex gap-3 px-4 py-3 transition-colors",
                        "hover:bg-[var(--muted)]/50",
                        isUnread && "bg-accent/5"
                      )}
                    >
                      <div
                        className={cn(
                          "h-7 w-7 shrink-0 flex items-center justify-center rounded-sm",
                          isUnread
                            ? "bg-accent/15 text-accent"
                            : "bg-[var(--muted)] text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm truncate",
                            isUnread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-muted-foreground truncate">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRelativeDate(n.created_at)}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-2" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
