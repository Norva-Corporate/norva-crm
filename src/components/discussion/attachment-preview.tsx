"use client";

import { useEffect, useState } from "react";
import { File as FileIcon, FileText, Image as ImageIcon, X } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/actions/discussions";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types";

function isImage(mime: string) {
  return mime.startsWith("image/");
}
function isPdf(mime: string) {
  return mime === "application/pdf";
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove?: () => void;
  compact?: boolean;
}

export function AttachmentPreview({
  attachment,
  onRemove,
  compact = false,
}: AttachmentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getAttachmentSignedUrl(attachment.path, 3600);
      if (!cancelled && result.success) {
        setUrl(result.data.url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.path]);

  const Icon = isImage(attachment.mime)
    ? ImageIcon
    : isPdf(attachment.mime)
      ? FileText
      : FileIcon;

  if (isImage(attachment.mime) && url && !compact) {
    return (
      <div className="relative inline-block max-w-sm group">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.name}
            className="max-h-64 w-auto border border-[var(--border)] rounded-sm"
          />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center bg-black/60 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Retirer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-2 bg-[var(--muted)] border border-[var(--border)] rounded-sm max-w-xs",
        compact && "py-1"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={attachment.name}
            className="block text-xs font-medium text-foreground hover:text-accent truncate"
          >
            {attachment.name}
          </a>
        ) : (
          <span className="block text-xs font-medium text-muted-foreground truncate">
            {attachment.name}
          </span>
        )}
        <span className="block text-[10px] text-muted-foreground">
          {formatBytes(attachment.size)}
        </span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Retirer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
