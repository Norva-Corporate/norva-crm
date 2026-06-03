import * as React from "react";
import { cn } from "@/lib/utils";

type InputSize = "default" | "touch";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /**
   * "touch" force h-11 sur mobile (cible tactile ≥44px) puis redescend en h-9 sur md+.
   * Utile pour les inputs de formulaire dans les drawers et les barres de recherche.
   */
  size?: InputSize;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "default", ...props }, ref) => {
    const sizeClass =
      size === "touch"
        ? "h-11 text-base md:h-9 md:text-sm"
        : "h-9 text-sm";
    return (
      <input
        type={type}
        className={cn(
          "flex w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-foreground placeholder:text-muted-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
          sizeClass,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
