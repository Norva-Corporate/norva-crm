"use client";

import { useState, useTransition } from "react";
import { Loader2, Archive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ArchiveConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: string;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
}

export function ArchiveConfirmModal({
  open,
  onOpenChange,
  itemName,
  itemType,
  onConfirm,
}: ArchiveConfirmModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.success) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!pending) {
          if (!o) setError(null);
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-warning/15 flex items-center justify-center rounded-sm">
              <Archive className="h-4 w-4 text-warning" />
            </div>
            <DialogTitle>Archiver {itemType}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-4 md:px-6 pb-2 space-y-2">
          <p className="text-sm text-foreground">
            Archiver{" "}
            <span className="font-medium text-foreground">{itemName}</span> ?
          </p>
          <p className="text-xs text-muted-foreground">
            L&apos;élément est masqué du CRM mais reste en base. Restauration
            possible côté admin si besoin.
          </p>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button variant="default" onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
