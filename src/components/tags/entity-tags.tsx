"use client";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Plus, Tag as TagIcon, X, Loader2, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  attachTag,
  createTag,
  detachTag,
  listTags,
} from "@/lib/actions/tags";
import { cn } from "@/lib/utils";
import type { Tag, TagEntityType } from "@/types";

const PALETTE = [
  "#3B7BF5",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
];

interface Props {
  entityType: TagEntityType;
  entityId: string;
  initialTags: Tag[];
  /** Whether to show the picker trigger inline or hidden until hover. Default true. */
  showPicker?: boolean;
  className?: string;
}

function EntityTagsImpl({
  entityType,
  entityId,
  initialTags,
  showPicker = true,
  className,
}: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [pending, startTransition] = useTransition();

  const handleDetach = (tag: Tag) => {
    setTags((prev) => prev.filter((t) => t.id !== tag.id));
    startTransition(async () => {
      const res = await detachTag(tag.id, entityType, entityId);
      if (!res.success) {
        // revert
        setTags((prev) =>
          prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
        );
      }
    });
  };

  const handleAttach = (tag: Tag) => {
    if (tags.some((t) => t.id === tag.id)) return;
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    startTransition(async () => {
      const res = await attachTag(tag.id, entityType, entityId);
      if (!res.success) {
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
      }
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          onRemove={() => handleDetach(tag)}
          disabled={pending}
        />
      ))}
      {showPicker && (
        <TagPicker
          attachedIds={tags.map((t) => t.id)}
          onAttach={handleAttach}
        />
      )}
    </div>
  );
}

// React.memo : initialTags est un tableau passé par le parent ; tant que
// la référence ne change pas, on évite le re-render du composant + son
// popover. Le state interne reste éphémère.
export const EntityTags = React.memo(EntityTagsImpl);

export function TagBadge({
  tag,
  onRemove,
  disabled,
}: {
  tag: Tag;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border"
      style={{
        backgroundColor: `${tag.color}1f`,
        color: tag.color,
        borderColor: `${tag.color}55`,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer ${tag.name}`}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface TagPickerProps {
  attachedIds: string[];
  onAttach: (tag: Tag) => void;
}

function TagPicker({ attachedIds, onAttach }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorIndexRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTags()
      .then((rows) => setAllTags(rows))
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    return allTags.filter(
      (t) => !q || t.name.toLowerCase().includes(q)
    );
  }, [allTags, trimmed]);

  const exactMatch = useMemo(
    () => allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase()),
    [allTags, trimmed]
  );

  const handleCreate = async () => {
    if (!trimmed) return;
    if (exactMatch) {
      if (!attachedIds.includes(exactMatch.id)) onAttach(exactMatch);
      setQuery("");
      return;
    }
    setCreating(true);
    const color = PALETTE[colorIndexRef.current % PALETTE.length];
    colorIndexRef.current += 1;
    const res = await createTag({ name: trimmed, color });
    setCreating(false);
    if (res.success) {
      setAllTags((prev) =>
        prev.some((t) => t.id === res.data.id) ? prev : [...prev, res.data]
      );
      onAttach(res.data);
      setQuery("");
    }
  };

  const handlePick = (tag: Tag) => {
    if (attachedIds.includes(tag.id)) return;
    onAttach(tag);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-[var(--border)] hover:border-accent rounded-sm transition-colors"
        >
          <Plus className="h-3 w-3" />
          Tag
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0 bg-[var(--card)] border border-[var(--border)]"
      >
        <div className="px-3 h-9 border-b border-[var(--border)] flex items-center gap-2">
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="Chercher ou créer…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {(loading || creating) && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            trimmed ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-[var(--muted)]/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Créer{" "}
                <span className="font-medium">&laquo; {trimmed} &raquo;</span>
              </button>
            ) : (
              <p className="px-3 py-3 text-[11px] text-muted-foreground">
                Aucun tag. Tape pour en créer un.
              </p>
            )
          ) : (
            <>
              {filtered.map((t) => {
                const attached = attachedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handlePick(t)}
                    disabled={attached}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                      attached
                        ? "opacity-50 cursor-default"
                        : "hover:bg-[var(--muted)]/50"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-xs text-foreground flex-1 truncate">
                      {t.name}
                    </span>
                    {attached && (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
              {trimmed && !exactMatch && (
                <>
                  <div className="my-1 border-t border-[var(--border)]" />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-[var(--muted)]/50 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Créer{" "}
                    <span className="font-medium">&laquo; {trimmed} &raquo;</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
