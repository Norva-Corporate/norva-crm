"use client";

import React, { useEffect, useState } from "react";
import { Loader, PhoneCall } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { CallLogger } from "./CallLogger";
import { CallHistory } from "./CallHistory";
import { getCallsForEntity, type CallLogRow } from "@/lib/actions/calls";
import type { CallEntityType } from "@/lib/call-outcomes";

interface Props {
  entityType: CallEntityType;
  entityId: string;
}

function CallsSectionImpl({ entityType, entityId }: Props) {
  const [items, setItems] = useState<CallLogRow[] | null>(null);

  // Chargement différé au mount / changement d'entité (calque du drawer).
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    getCallsForEntity(entityType, entityId).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <PhoneCall className="h-3.5 w-3.5" />
        Appels
      </h2>

      <PermissionGate require="calls.create">
        <CallLogger
          entityType={entityType}
          entityId={entityId}
          onLogged={(row) => setItems((prev) => [row, ...(prev ?? [])])}
        />
      </PermissionGate>

      <div className="pt-1 border-t border-[var(--border)]">
        {items === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader className="h-3 w-3 animate-spin" />
            Chargement…
          </div>
        ) : (
          <CallHistory
            items={items}
            onDeleted={(id) =>
              setItems((prev) => (prev ?? []).filter((i) => i.id !== id))
            }
          />
        )}
      </div>
    </Card>
  );
}

export const LeadCallsSection = React.memo(CallsSectionImpl);
