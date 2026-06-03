"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerPortal = DialogPrimitive.Portal;
const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

type DrawerSide = "left" | "right" | "bottom";

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: DrawerSide;
  showCloseButton?: boolean;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = "right", showCloseButton = true, ...props }, ref) => {
  const isBottom = side === "bottom";
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 bg-[var(--card)] shadow-card-hover flex flex-col",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
          !isBottom && "top-0 h-full w-full sm:w-[480px]",
          side === "right" && [
            "right-0 border-l border-[var(--border)]",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          ],
          side === "left" && [
            "left-0 border-r border-[var(--border)]",
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          ],
          isBottom && [
            "bottom-0 left-0 right-0 w-full max-h-[92vh] rounded-t-xl border-t border-[var(--border)]",
            "pb-[env(safe-area-inset-bottom)]",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          ],
          className
        )}
        {...props}
      >
        {isBottom && (
          <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
            <div
              aria-hidden
              className="h-1 w-10 rounded-full bg-[var(--border)]"
            />
          </div>
        )}
        {children}
        {showCloseButton && !isBottom && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1 px-4 md:px-6 py-4 md:py-5 border-b border-[var(--border)] flex-shrink-0",
      className
    )}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5", className)}
    {...props}
  />
);
DrawerBody.displayName = "DrawerBody";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-[var(--border)] flex-shrink-0",
      className
    )}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-foreground", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
