"use client";

import { useState } from "react";
import { Hash, Menu, X } from "lucide-react";
import { ChannelSidebar } from "@/components/discussion/channel-sidebar";
import { ChannelCreateDialog } from "@/components/discussion/channel-create-dialog";
import { ChannelSettingsDialog } from "@/components/discussion/channel-settings-dialog";
import { MessageList } from "@/components/discussion/message-list";
import { MessageComposer } from "@/components/discussion/message-composer";
import { MessageThreadPanel } from "@/components/discussion/message-thread-panel";
import { cn } from "@/lib/utils";
import type { DiscussionChannel, DiscussionMessage } from "@/types";

interface DiscussionLayoutProps {
  channels: DiscussionChannel[];
  activeChannel: DiscussionChannel | null;
  initialMessages: DiscussionMessage[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function DiscussionLayout({
  channels,
  activeChannel,
  initialMessages,
  currentUserId,
  isAdmin,
}: DiscussionLayoutProps) {
  const [threadParent, setThreadParent] = useState<DiscussionMessage | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop sidebar */}
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannel?.id ?? null}
        isAdmin={isAdmin}
      />

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className={cn(
              "relative w-64 h-full bg-[var(--sidebar)] border-r border-[var(--sidebar-border)]",
              "animate-in slide-in-from-left duration-200"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--sidebar-border)]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
                Canaux
              </h2>
              <div className="flex items-center gap-1">
                <ChannelCreateDialog />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="h-7 w-7 flex items-center justify-center text-[var(--sidebar-muted)] hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav className="overflow-y-auto py-2">
              {channels.map((c) => (
                <a
                  key={c.id}
                  href={`/dashboard/discussion/${c.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 text-sm",
                    c.id === activeChannel?.id
                      ? "bg-accent/15 text-accent border-l-2 border-accent"
                      : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5 border-l-2 border-transparent"
                  )}
                >
                  <Hash className="h-3.5 w-3.5" />
                  {c.name}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        {activeChannel ? (
          <>
            <header className="flex items-center gap-3 h-12 px-4 border-b border-[var(--border)] bg-[var(--card)]">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Ouvrir la liste des canaux"
              >
                <Menu className="h-4 w-4" />
              </button>

              <Hash className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold text-foreground truncate">
                  {activeChannel.name}
                </h1>
                {activeChannel.description && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeChannel.description}
                  </p>
                )}
              </div>
              <div className="opacity-100">
                <ChannelSettingsDialog channel={activeChannel} isAdmin={isAdmin} />
              </div>
            </header>

            <MessageList
              channelId={activeChannel.id}
              channelName={activeChannel.name}
              initialMessages={initialMessages}
              currentUserId={currentUserId}
              onOpenThread={setThreadParent}
            />

            <MessageComposer
              channelId={activeChannel.id}
              placeholder={`Message dans #${activeChannel.name}`}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden absolute top-4 left-4 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Ouvrir la liste des canaux"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Hash className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              Aucun canal sélectionné
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sélectionnez un canal dans la barre latérale ou créez-en un nouveau.
            </p>
          </div>
        )}
      </div>

      {/* Thread panel */}
      {threadParent && activeChannel && (
        <MessageThreadPanel
          channelId={activeChannel.id}
          parent={threadParent}
          currentUserId={currentUserId}
          onClose={() => setThreadParent(null)}
        />
      )}
    </div>
  );
}
