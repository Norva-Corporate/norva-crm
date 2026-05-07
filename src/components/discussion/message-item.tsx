"use client";

import { useState } from "react";
import { MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/discussion/markdown-content";
import { AttachmentPreview } from "@/components/discussion/attachment-preview";
import { deleteMessage } from "@/lib/actions/discussions";
import { cn, getInitials } from "@/lib/utils";
import type { DiscussionMessage } from "@/types";

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 45) return "à l'instant";
  if (diff < 90) return "il y a 1 min";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 7200) return "il y a 1 h";
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  // same day if today
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MessageItemProps {
  message: DiscussionMessage;
  currentUserId: string | null;
  isThreadParent?: boolean;
  threadCount?: number;
  onOpenThread?: (message: DiscussionMessage) => void;
  showAvatar?: boolean;
}

export function MessageItem({
  message,
  currentUserId,
  isThreadParent,
  threadCount = 0,
  onOpenThread,
  showAvatar = true,
}: MessageItemProps) {
  const [hovering, setHovering] = useState(false);
  const isOwn = currentUserId === message.user_id;
  const author = message.author;
  const authorName = author?.full_name?.trim() || author?.email || "Utilisateur";

  const handleDelete = async () => {
    if (!confirm("Supprimer ce message ?")) return;
    const result = await deleteMessage(message.id);
    if (!result.success) toast.error(result.error);
  };

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "group relative flex gap-3 px-4 py-2 transition-colors",
        "hover:bg-white/[0.02]"
      )}
      data-message-id={message.id}
    >
      {showAvatar ? (
        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(authorName)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-9 shrink-0 flex items-start justify-center pt-1">
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
            {new Date(message.created_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground">
              {authorName}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {formatChatTime(message.created_at)}
            </span>
          </div>
        )}

        {message.content && (
          <MarkdownContent content={message.content} />
        )}

        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <AttachmentPreview key={a.path} attachment={a} />
            ))}
          </div>
        )}

        {isThreadParent && threadCount > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-medium"
          >
            <MessageSquare className="h-3 w-3" />
            {threadCount} {threadCount > 1 ? "réponses" : "réponse"}
          </button>
        )}
      </div>

      {hovering && (
        <div className="absolute top-1 right-3 flex items-center gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-sm shadow-sm">
          {onOpenThread && !isThreadParent && (
            <button
              type="button"
              onClick={() => onOpenThread(message)}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)]"
              title="Répondre dans un thread"
              aria-label="Répondre"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-[var(--muted)]"
              title="Supprimer"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DeletedMessageItem({
  message,
}: {
  message: DiscussionMessage;
}) {
  return (
    <div className="flex gap-3 px-4 py-2 opacity-60">
      <div className="w-9 shrink-0" />
      <div className="flex-1 text-xs italic text-muted-foreground">
        Message supprimé
        <span className="ml-2 font-mono text-[10px]">
          {formatChatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
