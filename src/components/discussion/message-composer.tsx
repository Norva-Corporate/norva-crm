"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionPicker } from "@/components/discussion/mention-picker";
import { AttachmentPreview } from "@/components/discussion/attachment-preview";
import {
  sendMessage,
  uploadAttachment,
} from "@/lib/actions/discussions";
import { renderMentionMarkdown } from "@/lib/discussion/mention-format";
import type { Attachment, Mention } from "@/types";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  channelId: string;
  parentId?: string | null;
  placeholder?: string;
  onSent?: () => void;
}

interface MentionState {
  open: boolean;
  query: string;
  triggerStart: number; // index of '@' in textarea value
  position: { top: number; left: number };
}

const initialMentionState: MentionState = {
  open: false,
  query: "",
  triggerStart: -1,
  position: { top: 0, left: 0 },
};

export function MessageComposer({
  channelId,
  parentId,
  placeholder,
  onSent,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mention, setMention] = useState<MentionState>(initialMentionState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeMention = useCallback(() => {
    setMention(initialMentionState);
  }, []);

  const detectMention = useCallback((value: string, caret: number) => {
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const before = i === 0 ? " " : value[i - 1];
        if (before === " " || before === "\n" || before === "\t" || i === 0) {
          const query = value.slice(i + 1, caret);
          if (/\s/.test(query)) return null;
          return { triggerStart: i, query };
        }
        return null;
      }
      if (ch === " " || ch === "\n" || ch === "\t") return null;
      i -= 1;
    }
    return null;
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      const caret = e.target.selectionStart;
      const detected = detectMention(value, caret);
      if (detected) {
        const rect = e.target.getBoundingClientRect();
        setMention({
          open: true,
          query: detected.query,
          triggerStart: detected.triggerStart,
          position: { top: rect.top - 8, left: rect.left + 16 },
        });
      } else if (mention.open) {
        closeMention();
      }
    },
    [detectMention, mention.open, closeMention]
  );

  const insertMention = useCallback(
    (m: Mention) => {
      if (mention.triggerStart < 0) return;
      const before = content.slice(0, mention.triggerStart);
      const caret = textareaRef.current?.selectionStart ?? content.length;
      const after = content.slice(caret);
      const inserted = renderMentionMarkdown(m);
      const next = `${before}${inserted} ${after}`;
      setContent(next);
      closeMention();
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          const newPos = before.length + inserted.length + 1;
          ta.focus();
          ta.setSelectionRange(newPos, newPos);
        }
      });
    },
    [content, mention.triggerStart, closeMention]
  );

  const submit = useCallback(async () => {
    if (submitting) return;
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    setSubmitting(true);
    const result = await sendMessage({
      channelId,
      content: trimmed,
      parentId: parentId ?? null,
      attachments,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setContent("");
    setAttachments([]);
    closeMention();
    onSent?.();
  }, [submitting, content, attachments, channelId, parentId, onSent, closeMention]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mention.open) {
        // arrow/enter handled in MentionPicker via window listener
        if (
          e.key === "Enter" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "Tab" ||
          e.key === "Escape"
        ) {
          // let MentionPicker handle it
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    },
    [mention.open, submit]
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      e.target.value = "";

      setUploading(true);
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadAttachment(fd);
        if (!result.success) {
          toast.error(`${file.name} : ${result.error}`);
          continue;
        }
        setAttachments((prev) => [...prev, result.data]);
      }
      setUploading(false);
    },
    []
  );

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  // auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [content]);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--card)]">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachments.map((a) => (
            <AttachmentPreview
              key={a.path}
              attachment={a}
              onRemove={() => removeAttachment(a.path)}
              compact={!a.mime.startsWith("image/")}
            />
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition-colors shrink-0",
            uploading && "opacity-50 cursor-not-allowed"
          )}
          title="Joindre un fichier"
          aria-label="Joindre un fichier"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Écris un message…  (Markdown · @ pour mentionner · Cmd+Entrée pour envoyer)"}
          rows={1}
          className="min-h-[36px] max-h-[200px] py-2 px-3"
        />

        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={
            submitting ||
            (content.trim().length === 0 && attachments.length === 0)
          }
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>

        {mention.open && (
          <MentionPicker
            query={mention.query}
            position={mention.position}
            onSelect={insertMention}
            onClose={closeMention}
          />
        )}
      </div>
    </div>
  );
}
