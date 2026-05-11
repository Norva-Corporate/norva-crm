"use client";

import { useState } from "react";
import Link from "next/link";
import { Hash, Menu, X, ChevronRight, ArrowLeft } from "lucide-react";
import { ChannelSidebar } from "@/components/discussion/channel-sidebar";
import { ChannelCreateDialog } from "@/components/discussion/channel-create-dialog";
import { ChannelSettingsDialog } from "@/components/discussion/channel-settings-dialog";
import { MessageList } from "@/components/discussion/message-list";
import { MessageComposer } from "@/components/discussion/message-composer";
import { MessageThreadPanel } from "@/components/discussion/message-thread-panel";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
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
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const { setOpen: setGlobalMobileSidebarOpen } = useMobileSidebar();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop : sidebar fixe */}
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannel?.id ?? null}
        isAdmin={isAdmin}
      />

      {/* Mobile : sidebar canaux en overlay (accessible via le bouton "Canaux") */}
      {mobileChannelsOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileChannelsOpen(false)}
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
              <button
                type="button"
                onClick={() => {
                  setMobileChannelsOpen(false);
                  setGlobalMobileSidebarOpen(true);
                }}
                className="h-7 w-7 flex items-center justify-center text-[var(--sidebar-muted)] hover:text-foreground"
                aria-label="Ouvrir le menu principal"
              >
                <Menu className="h-4 w-4" />
              </button>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
                Canaux
              </h2>
              <div className="flex items-center gap-1">
                <ChannelCreateDialog />
                <button
                  type="button"
                  onClick={() => setMobileChannelsOpen(false)}
                  className="h-7 w-7 flex items-center justify-center text-[var(--sidebar-muted)] hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav className="overflow-y-auto py-2">
              {channels.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/discussion/${c.id}`}
                  onClick={() => setMobileChannelsOpen(false)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 text-sm",
                    c.id === activeChannel?.id
                      ? "bg-accent/15 text-accent border-l-2 border-accent"
                      : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5 border-l-2 border-transparent"
                  )}
                >
                  <Hash className="h-3.5 w-3.5" />
                  {c.name}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        {activeChannel ? (
          <>
            <header className="flex items-center gap-2 md:gap-3 h-12 px-3 md:px-4 border-b border-[var(--border)] bg-[var(--card)]">
              {/* Mobile : ouvre la liste des canaux (back vers liste) */}
              <button
                type="button"
                onClick={() => setMobileChannelsOpen(true)}
                className="md:hidden h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Voir tous les canaux"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
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
          <>
            {/* Mobile : liste des canaux en pleine page */}
            <div className="md:hidden flex-1 flex flex-col">
              <header className="flex items-center gap-2 h-12 px-3 border-b border-[var(--border)] bg-[var(--card)]">
                <button
                  type="button"
                  onClick={() => setGlobalMobileSidebarOpen(true)}
                  className="h-8 w-8 flex items-center justify-center text-foreground hover:bg-white/5 rounded-sm shrink-0"
                  aria-label="Ouvrir le menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="text-sm font-semibold text-foreground flex-1">
                  Canaux
                </h1>
                <ChannelCreateDialog />
              </header>
              <nav className="flex-1 overflow-y-auto">
                {channels.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Hash className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      Aucun canal
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Créez votre premier canal pour commencer.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {channels.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/discussion/${c.id}`}
                          className="flex items-center gap-3 h-12 px-4 hover:bg-white/5 transition-colors"
                        >
                          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.name}
                            </p>
                            {c.description && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
            </div>
            {/* Desktop : empty state */}
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-4">
              <Hash className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                Aucun canal sélectionné
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez un canal dans la barre latérale ou créez-en un nouveau.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Thread : panneau latéral desktop, overlay plein écran mobile (back button intégré) */}
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
