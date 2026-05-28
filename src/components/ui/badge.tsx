import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent/15 text-accent border border-accent/30",
        secondary: "bg-[var(--muted)] text-muted-foreground border border-[var(--border)]",
        destructive: "bg-destructive/15 text-destructive border border-destructive/30",
        success: "bg-success/15 text-success border border-success/30",
        warning: "bg-warning/15 text-warning border border-warning/30",
        outline: "border border-[var(--border)] text-foreground",
        discussion: "bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30",
        proposal: "bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30",
        negotiation: "bg-[#F97316]/15 text-[#FB923C] border border-[#F97316]/30",
        won: "bg-[#22C55E]/15 text-[#4ADE80] border border-[#22C55E]/30",
        lost: "bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
