"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArchiveConfirmModal } from "@/components/briefs/archive-confirm-modal";
import { archiveBrief } from "@/lib/actions/briefs";

interface ArchiveBriefButtonProps {
  briefId: string;
  briefName: string;
}

export function ArchiveBriefButton({
  briefId,
  briefName,
}: ArchiveBriefButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleConfirm = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const res = await archiveBrief(briefId);
    if (res.success) {
      toast.success("Brief archivé");
      router.push("/dashboard/briefs");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    return res;
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Archive className="h-3.5 w-3.5" />
        Archiver
      </Button>
      <ArchiveConfirmModal
        open={open}
        onOpenChange={setOpen}
        itemName={briefName}
        itemType="le brief"
        onConfirm={handleConfirm}
      />
    </>
  );
}
