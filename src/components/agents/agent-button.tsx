"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enqueueAgentTask } from "@/lib/actions/agent-tasks";
import type { AgentName, AgentTaskEntityType } from "@/types";

interface Props {
  agent: AgentName;
  entityType?: AgentTaskEntityType;
  entityId?: string;
  context?: Record<string, unknown>;
  label?: string;
  shortLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
  /** Message affiché au toast après enqueue. Default = "Tâche en file…" */
  successMessage?: string;
}

export function AgentButton({
  agent,
  entityType,
  entityId,
  context,
  label,
  shortLabel,
  icon: Icon = Sparkles,
  variant = "outline",
  size = "sm",
  className,
  disabled,
  successMessage,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setLastEnqueuedAt] = useState<number | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await enqueueAgentTask({
        agent,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        context,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setLastEnqueuedAt(Date.now());
      toast.success(
        successMessage ??
          "Tâche en file. Lance l'agent dans multica pour l'exécuter."
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={pending || disabled}
      title={label}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {shortLabel ?? label ?? "Lancer agent"}
    </Button>
  );
}
