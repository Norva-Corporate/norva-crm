"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInlineOptimistic } from "@/hooks/use-inline-optimistic";
import { cn } from "@/lib/utils";

type ActionResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

const NONE_VALUE = "__none__";
const SPINNER_DELAY_MS = 800;

interface BaseProps {
  value: string | null;
  onSave: (next: string | null) => Promise<ActionResult>;
  ariaLabel: string;
  displayAs?: (value: string | null) => React.ReactNode;
  emptyDisplay?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export interface InlineSelectProps extends BaseProps {
  variant: "select";
  options: Array<{ value: string; label: string }>;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export interface InlineDateProps extends BaseProps {
  variant: "date";
  min?: string;
  max?: string;
}

export type InlinePickerProps = InlineSelectProps | InlineDateProps;

export function InlinePicker(props: InlinePickerProps) {
  const router = useRouter();
  const optimistic = useInlineOptimistic<string | null>(props.value);
  const latestSaveIdRef = React.useRef(0);
  const [showSpinner, setShowSpinner] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (optimistic.isPending) {
      timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    } else {
      setShowSpinner(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [optimistic.isPending]);

  function commit(next: string | null) {
    if (next === optimistic.value) return;
    const saveId = ++latestSaveIdRef.current;

    optimistic.startTransition(async () => {
      optimistic.setOptimistic(next);
      const result = await props.onSave(next);
      if (saveId !== latestSaveIdRef.current) return;
      if (!result.success) {
        toast.error(result.error, { id: props.ariaLabel });
        router.refresh();
      }
    });
  }

  if (props.variant === "select") {
    const { options, allowEmpty, emptyLabel = "Aucun(e)" } = props;
    const currentValue = optimistic.value ?? "";
    const selectValue = currentValue || (allowEmpty ? NONE_VALUE : "");

    return (
      <div className={cn("inline-flex items-center gap-1.5", props.className)}>
        <Select
          value={selectValue}
          onValueChange={(v) => commit(v === NONE_VALUE ? null : v)}
          disabled={props.disabled}
        >
          <SelectTrigger
            aria-label={props.ariaLabel}
            className={cn(
              "h-auto min-h-[1.75rem] w-full",
              "border-transparent bg-transparent px-1.5 py-0.5",
              "hover:border-[var(--border)] hover:bg-[var(--muted)]/40",
              "focus:border-accent focus:ring-1 focus:ring-accent",
              "transition-colors text-left",
              "data-[placeholder]:text-muted-foreground",
              "[&>span]:line-clamp-none [&>span]:flex-1",
              "[&_svg]:opacity-0 hover:[&_svg]:opacity-100 focus:[&_svg]:opacity-100 [&_svg]:transition-opacity",
              optimistic.isPending && "opacity-60",
              props.triggerClassName
            )}
          >
            {props.displayAs ? (
              <span>
                {props.displayAs(optimistic.value)}
              </span>
            ) : (
              <SelectValue placeholder={emptyLabel}>
                {options.find((o) => o.value === optimistic.value)?.label ??
                  (props.emptyDisplay ?? <span className="text-muted-foreground">—</span>)}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && (
              <SelectItem value={NONE_VALUE}>
                <span className="text-muted-foreground">{emptyLabel}</span>
              </SelectItem>
            )}
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showSpinner && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
        )}
      </div>
    );
  }

  const { min, max } = props;
  const currentDate = optimistic.value ?? "";
  const display = optimistic.value
    ? props.displayAs
      ? props.displayAs(optimistic.value)
      : currentDate
    : props.emptyDisplay ?? <span className="text-muted-foreground">—</span>;

  return (
    <label
      className={cn(
        "group relative inline-flex items-center gap-1.5 cursor-text",
        "px-1.5 py-0.5 -mx-1.5 -my-0.5",
        "border border-transparent hover:border-[var(--border)] hover:bg-[var(--muted)]/40",
        "transition-colors",
        optimistic.isPending && "opacity-60",
        props.disabled && "opacity-60 cursor-not-allowed",
        props.className
      )}
    >
      <span className="flex-1 min-w-0">{display}</span>
      <input
        type="date"
        value={currentDate}
        min={min}
        max={max}
        disabled={props.disabled}
        onChange={(e) => commit(e.target.value || null)}
        aria-label={props.ariaLabel}
        className="absolute inset-0 opacity-0 cursor-text disabled:cursor-not-allowed"
      />
      {showSpinner && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
      )}
    </label>
  );
}
