"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureDealDriveFolder } from "@/lib/actions/deals";
import { ensureProjectDriveFolder } from "@/lib/actions/projects";

type Kind = "deal" | "project";

interface Props {
  kind: Kind;
  /** id du deal ou du projet */
  id: string;
  /** URL en cache (drive_folder_url). Si présente, on affiche "Ouvrir". */
  initialUrl: string | null;
}

/**
 * Bouton unique pour ouvrir OU créer le dossier Google Drive lié à
 * un deal ou un projet. État local pour ne pas refresh la page après
 * création (l'URL est mémorisée le temps que `router.refresh()` la
 * persiste côté serveur).
 */
export function DriveFolderButton({ kind, id, initialUrl }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, startTransition] = useTransition();

  function openDrive(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleClick() {
    if (url) {
      openDrive(url);
      return;
    }
    startTransition(async () => {
      const action =
        kind === "deal" ? ensureDealDriveFolder : ensureProjectDriveFolder;
      const result = await action(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setUrl(result.data.url);
      toast.success("Dossier Drive créé.");
      openDrive(result.data.url);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5 h-8 text-xs"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : url ? (
        <ExternalLink className="h-3.5 w-3.5" />
      ) : (
        <FolderPlus className="h-3.5 w-3.5" />
      )}
      {url ? "Ouvrir dans Drive" : "Créer dossier Drive"}
    </Button>
  );
}
