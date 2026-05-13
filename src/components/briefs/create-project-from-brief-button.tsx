"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProjectFromBrief } from "@/lib/actions/briefs";

interface CreateProjectFromBriefButtonProps {
  briefId: string;
  briefName: string;
  hasContact: boolean;
  hasCompany: boolean;
}

export function CreateProjectFromBriefButton({
  briefId,
  briefName,
  hasContact,
  hasCompany,
}: CreateProjectFromBriefButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await createProjectFromBrief(briefId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Projet créé");
      setOpen(false);
      router.push(`/dashboard/projets/${res.data.projectId}`);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderPlus className="h-3.5 w-3.5" />
        Créer un projet
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!pending) setOpen(o);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-accent/15 flex items-center justify-center rounded-sm">
                <FolderPlus className="h-4 w-4 text-accent" />
              </div>
              <DialogTitle>Créer un projet</DialogTitle>
            </div>
            <DialogDescription>
              Un projet est créé à partir du brief de{" "}
              <span className="font-medium text-foreground">{briefName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 md:px-6 pb-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Liaisons pré-remplies :
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
              <li>
                Contact :{" "}
                {hasContact ? (
                  <span className="text-foreground">depuis le brief</span>
                ) : (
                  <span className="text-muted-foreground/70">aucun</span>
                )}
              </li>
              <li>
                Entreprise :{" "}
                {hasCompany ? (
                  <span className="text-foreground">depuis le brief</span>
                ) : (
                  <span className="text-muted-foreground/70">aucune</span>
                )}
              </li>
              <li>Statut : en attente</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              Tu pourras ajuster nom, budget, équipe et dates depuis la page projet.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
