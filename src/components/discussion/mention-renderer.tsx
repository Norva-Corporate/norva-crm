"use client";

import Link from "next/link";
import { AtSign, Briefcase, FileText, FolderKanban, ListChecks, User as UserIcon } from "lucide-react";
import type { MentionType } from "@/types";
import { buildMentionLink } from "@/lib/discussion/mention-format";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<MentionType, React.ComponentType<{ className?: string }>> = {
  user: AtSign,
  company: Briefcase,
  contact: UserIcon,
  project: FolderKanban,
  task: ListChecks,
  invoice: FileText,
};

interface MentionRendererProps {
  type: MentionType;
  id: string;
  label: string;
  className?: string;
}

export function MentionRenderer({ type, id, label, className }: MentionRendererProps) {
  const Icon = TYPE_ICON[type] ?? AtSign;
  const href = buildMentionLink(type, id);
  const cleanLabel = label.startsWith("@") ? label.slice(1) : label;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-0.5 px-1 py-px bg-accent/15 text-accent",
        "hover:bg-accent/25 transition-colors text-[0.95em] font-medium rounded-sm",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{cleanLabel}</span>
    </Link>
  );
}
