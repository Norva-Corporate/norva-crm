"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInlineOptimistic } from "@/hooks/use-inline-optimistic";
import { cn } from "@/lib/utils";

type Variant = "text" | "email" | "tel" | "url" | "number" | "textarea";

type ActionResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export interface InlineTextProps {
  value: string | null;
  onSave: (next: string | null) => Promise<ActionResult>;
  ariaLabel: string;
  variant?: Variant;
  placeholder?: string;
  emptyDisplay?: React.ReactNode;
  /**
   * When provided, the field uses a display+edit toggle: the value is rendered
   * via displayAs (e.g. mailto link, formatted currency), and the user clicks
   * once to switch to an editable input.
   *
   * When omitted, the field is edit-first (Notion-style): the input is always
   * visible, styled to look like text. Clicking positions the cursor directly.
   */
  displayAs?: (value: string) => React.ReactNode;
  required?: boolean;
  validate?: (value: string) => string | null;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  rows?: number;
}

const SPINNER_DELAY_MS = 800;

function getInputType(variant: Variant): React.HTMLInputTypeAttribute {
  switch (variant) {
    case "email":
      return "email";
    case "tel":
      return "tel";
    case "url":
      return "url";
    case "number":
      return "number";
    default:
      return "text";
  }
}

export function InlineText(props: InlineTextProps) {
  return props.displayAs
    ? <DisplayEditField {...props} />
    : <EditFirstField {...props} />;
}

// ---------------------------------------------------------------------------
// Edit-first mode — the input is always rendered, click positions the cursor
// directly. No display/edit toggle. Used for plain text fields and textarea.
// ---------------------------------------------------------------------------
function EditFirstField({
  value,
  onSave,
  ariaLabel,
  variant = "text",
  placeholder,
  required = false,
  validate,
  disabled = false,
  className,
  inputClassName,
  rows = 4,
}: InlineTextProps) {
  const router = useRouter();
  const isTextarea = variant === "textarea";

  const [draft, setDraft] = React.useState<string>(value ?? "");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [showSpinner, setShowSpinner] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null
  );
  const latestSaveIdRef = React.useRef(0);
  const lastCommittedRef = React.useRef<string | null>(value);

  // Keep draft in sync with the prop when the user is not actively editing.
  React.useEffect(() => {
    if (!isFocused && !isPending) {
      setDraft(value ?? "");
      lastCommittedRef.current = value;
    }
  }, [value, isFocused, isPending]);

  // Delayed spinner: only show after 800 ms of pending state.
  React.useEffect(() => {
    if (!isPending) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [isPending]);

  function commit(nextDraft: string) {
    const trimmed = nextDraft.trim();
    const isEmpty = trimmed.length === 0;

    if (required && isEmpty) {
      toast.error(`${ariaLabel} est obligatoire — non sauvegardé.`, {
        id: ariaLabel,
      });
      setDraft(value ?? "");
      return;
    }

    if (validate && !isEmpty) {
      const customError = validate(trimmed);
      if (customError) {
        setError(customError);
        // Keep focus so the user can fix the value.
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    }

    const next: string | null = isEmpty ? null : nextDraft;
    if (next === lastCommittedRef.current) return;

    const saveId = ++latestSaveIdRef.current;
    lastCommittedRef.current = next;

    startTransition(async () => {
      const result = await onSave(next);
      if (saveId !== latestSaveIdRef.current) return;
      if (!result.success) {
        toast.error(result.error, { id: ariaLabel });
        setDraft(value ?? "");
        lastCommittedRef.current = value;
        router.refresh();
      }
    });
  }

  function handleBlur() {
    setIsFocused(false);
    if (error) return; // Don't commit while error is showing.
    if (isTextarea) {
      commit(draft);
      return;
    }
    commit(draft);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value ?? "");
      setError(null);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      if (isTextarea) {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          commit(draft);
          inputRef.current?.blur();
        }
        return;
      }
      e.preventDefault();
      commit(draft);
      inputRef.current?.blur();
    }
  }

  const baseField = cn(
    "border-transparent bg-transparent px-1.5 -mx-1.5",
    "hover:border-[var(--border)] hover:bg-[var(--muted)]/40",
    "focus-visible:border-accent focus-visible:bg-[var(--surface)]",
    "focus-visible:ring-1 focus-visible:ring-accent",
    "transition-colors",
    isPending && "opacity-60",
    error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive",
    inputClassName
  );

  return (
    <div className={cn("relative w-full", className)}>
      {isTextarea ? (
        <Textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={baseField}
          aria-label={ariaLabel}
        />
      ) : (
        <Input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={getInputType(variant)}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={baseField}
          aria-label={ariaLabel}
        />
      )}
      {error && (
        <p className="text-[10px] text-destructive mt-1">{error}</p>
      )}
      {isTextarea && isFocused && !error && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Cmd/Ctrl + Entrée pour enregistrer · Échap pour annuler
        </p>
      )}
      {showSpinner && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display+Edit mode — preserved for fields that have a formatted display
// (mailto/tel/url link, formatted currency). Click the display to enter
// edit mode.
// ---------------------------------------------------------------------------
function DisplayEditField({
  value,
  onSave,
  ariaLabel,
  variant = "text",
  placeholder,
  emptyDisplay,
  displayAs,
  required = false,
  validate,
  disabled = false,
  className,
  inputClassName,
  displayClassName,
  rows = 4,
}: InlineTextProps) {
  const router = useRouter();
  const optimistic = useInlineOptimistic<string | null>(value);
  const isTextarea = variant === "textarea";

  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [showSpinner, setShowSpinner] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null
  );
  const displayRef = React.useRef<HTMLButtonElement | null>(null);
  const latestSaveIdRef = React.useRef(0);

  React.useEffect(() => {
    if (!optimistic.isPending) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [optimistic.isPending]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Cursor at the end (don't select-all so re-clicking can position cursor)
      const len = inputRef.current.value.length;
      try {
        inputRef.current.setSelectionRange(len, len);
      } catch {
        /* number inputs may not support setSelectionRange */
      }
    }
  }, [isEditing]);

  function enterEdit() {
    if (disabled) return;
    setDraft(optimistic.value ?? "");
    setError(null);
    setIsEditing(true);
  }

  function exitEdit(returnFocus = true) {
    setIsEditing(false);
    setError(null);
    if (returnFocus) {
      requestAnimationFrame(() => displayRef.current?.focus());
    }
  }

  function commit(rawNext: string) {
    const trimmed = rawNext.trim();
    const isEmpty = trimmed.length === 0;

    if (required && isEmpty) {
      toast.error(`${ariaLabel} est obligatoire — non sauvegardé.`, {
        id: ariaLabel,
      });
      exitEdit();
      return;
    }

    if (validate && !isEmpty) {
      const customError = validate(trimmed);
      if (customError) {
        setError(customError);
        return;
      }
    }

    const next: string | null = isEmpty ? null : rawNext;
    if (next === optimistic.value) {
      exitEdit();
      return;
    }

    const saveId = ++latestSaveIdRef.current;

    optimistic.startTransition(async () => {
      optimistic.setOptimistic(next);
      const result = await onSave(next);
      if (saveId !== latestSaveIdRef.current) return;
      if (!result.success) {
        toast.error(result.error, { id: ariaLabel });
        router.refresh();
      }
    });

    exitEdit();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      exitEdit();
      return;
    }
    if (e.key === "Enter") {
      if (isTextarea) {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          commit(draft);
        }
        return;
      }
      e.preventDefault();
      commit(draft);
    }
  }

  function handleBlur() {
    if (isTextarea) {
      exitEdit();
      return;
    }
    commit(draft);
  }

  function handleDisplayKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enterEdit();
    }
  }

  if (isEditing && !disabled) {
    const commonClass = cn(
      "w-full",
      error &&
        "border-destructive focus-visible:border-destructive focus-visible:ring-destructive",
      inputClassName
    );

    return (
      <div className={cn("space-y-1", className)}>
        {isTextarea ? (
          <Textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={rows}
            className={commonClass}
            aria-label={ariaLabel}
          />
        ) : (
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type={getInputType(variant)}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={commonClass}
            aria-label={ariaLabel}
          />
        )}
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        {isTextarea && (
          <p className="text-[10px] text-muted-foreground">
            Cmd/Ctrl + Entrée pour enregistrer · Échap pour annuler
          </p>
        )}
      </div>
    );
  }

  const currentValue = optimistic.value;
  const hasValue = currentValue != null && currentValue !== "";
  const empty =
    emptyDisplay ?? <span className="text-muted-foreground">—</span>;

  return (
    <button
      ref={displayRef}
      type="button"
      onClick={enterEdit}
      onKeyDown={handleDisplayKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "group inline-flex w-full items-start gap-1.5 text-left",
        "px-1.5 py-0.5 -mx-1.5 -my-0.5",
        "border border-transparent hover:border-[var(--border)] hover:bg-[var(--muted)]/40",
        "transition-colors cursor-text",
        "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent",
        disabled &&
          "opacity-60 cursor-not-allowed hover:border-transparent hover:bg-transparent",
        optimistic.isPending && "opacity-60",
        displayClassName,
        className
      )}
    >
      <span className="flex-1 min-w-0">
        {hasValue
          ? displayAs!(currentValue as string)
          : placeholder
            ? <span className="text-muted-foreground">{placeholder}</span>
            : empty}
      </span>
      {showSpinner && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />
      )}
    </button>
  );
}
