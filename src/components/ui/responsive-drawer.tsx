"use client";
import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface ResponsiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Desktop side (mobile is always bottom). Default "right". */
  desktopSide?: "right" | "left";
  /** Optional class for the content wrapper (applied on both variants). */
  className?: string;
  showCloseButton?: boolean;
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  children,
  desktopSide = "right",
  className,
  showCloseButton = true,
}: ResponsiveDrawerProps) {
  const isMobile = useIsMobile();
  const side = isMobile ? "bottom" : desktopSide;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side={side}
        showCloseButton={showCloseButton}
        className={cn(className)}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}

export {
  DrawerHeader as ResponsiveDrawerHeader,
  DrawerBody as ResponsiveDrawerBody,
  DrawerFooter as ResponsiveDrawerFooter,
  DrawerTitle as ResponsiveDrawerTitle,
  DrawerDescription as ResponsiveDrawerDescription,
  DrawerClose as ResponsiveDrawerClose,
};
