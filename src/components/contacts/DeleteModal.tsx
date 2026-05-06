"use client";
import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom de l'élément à supprimer, affiché dans le message */
  itemName: string;
  /** Type d'élément ("contact", "entreprise"…) — affiché dans le titre */
  itemType?: string;
  /** Action serveur ou client retournant un résultat */
  onConfirm: () => Promise<{ success: boolean; error?: string } | void>;
  /** Texte d'aide additionnel (ex: "Tous les deals associés perdront leur lien") */
  description?: string;
}

export function DeleteModal({
  open,
  onOpenChange,
  itemName,
  itemType = "élément",
  onConfirm,
  description,
}: DeleteModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result && "success" in result && !result.success) {
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
            <div className="h-8 w-8 bg-destructive/15 flex items-center justify-center rounded-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Supprimer {itemType}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-2">
          <p className="text-sm text-foreground">
            Êtes-vous sûr de vouloir supprimer{" "}
            <span className="font-medium text-foreground">{itemName}</span> ?
          </p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Cette action est irréversible.
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
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
