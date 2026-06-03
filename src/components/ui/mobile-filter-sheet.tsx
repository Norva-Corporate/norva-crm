"use client";
import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface MobileFilterSheetProps {
  /** Contenu des filtres (chips, selects, etc.). Rendu inline sur desktop, dans un bottom sheet sur mobile. */
  children: React.ReactNode;
  /** Label du bouton mobile qui ouvre le sheet. Defaults "Filtres". */
  triggerLabel?: string;
  /** Badge numérique optionnel à afficher à côté du bouton (nb de filtres actifs). */
  activeCount?: number;
  /** Titre affiché en haut du sheet sur mobile. */
  title?: string;
  /** Si true, le sheet apparait aussi sur desktop (rare). Default false. */
  forceSheet?: boolean;
  /** Wrapper className pour le mode desktop (passe-plat). */
  className?: string;
}

/**
 * Sur mobile : remplace une flex-wrap de filtres par un bouton "Filtres" qui ouvre un bottom sheet.
 * Sur desktop : rend les enfants inline (sans wrapper en plus que `className`).
 *
 * Usage type :
 *   <MobileFilterSheet activeCount={3} title="Filtrer les tâches">
 *     <FilterChips ... />
 *     <StatusSelect ... />
 *   </MobileFilterSheet>
 */
export function MobileFilterSheet({
  children,
  triggerLabel = "Filtres",
  activeCount,
  title = "Filtres",
  forceSheet = false,
  className,
}: MobileFilterSheetProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  if (!isMobile && !forceSheet) {
    return <div className={cn("flex items-center gap-2 flex-wrap", className)}>{children}</div>;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="touch-sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>{triggerLabel}</span>
        {activeCount != null && activeCount > 0 && (
          <span
            aria-label={`${activeCount} filtres actifs`}
            className="ml-1 inline-flex h-5 min-w-5 items-center justify-center bg-accent text-[10px] font-semibold text-white rounded-full px-1.5"
          >
            {activeCount}
          </span>
        )}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="bottom">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="flex flex-col gap-3">{children}</div>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" size="touch" className="w-full">
                Appliquer
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
