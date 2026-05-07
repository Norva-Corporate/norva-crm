"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteChannel, updateChannel } from "@/lib/actions/discussions";
import type { DiscussionChannel } from "@/types";

interface ChannelSettingsDialogProps {
  channel: DiscussionChannel;
  isAdmin: boolean;
}

export function ChannelSettingsDialog({
  channel,
  isAdmin,
}: ChannelSettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await updateChannel({
      id: channel.id,
      name,
      description,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Canal mis à jour");
    setOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Supprimer le canal #${channel.name} et tous ses messages ? Cette action est irréversible.`
      )
    )
      return;
    setSubmitting(true);
    const result = await deleteChannel(channel.id);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Canal supprimé");
    setOpen(false);
    router.push("/dashboard/discussion");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition-colors"
          title="Paramètres du canal"
          aria-label="Paramètres du canal"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Paramètres du canal</DialogTitle>
            <DialogDescription>
              Modifie le nom ou la description.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nom</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            {isAdmin && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting}
                className="mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
