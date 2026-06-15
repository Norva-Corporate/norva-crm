"use client";

import React, { useEffect, useState } from "react";
import { Loader, MessageSquareWarning } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { ObjectionLogger } from "./ObjectionLogger";
import { ObjectionHistory } from "./ObjectionHistory";
import {
  getObjectionsForEntity,
  type ObjectionLogRow,
} from "@/lib/actions/objections";
import { detectPainId } from "@/lib/trame-r1";
import type { ObjectionEntityType } from "@/lib/objections";

interface Props {
  entityType: ObjectionEntityType;
  entityId: string;
  rawPayload?: Record<string, unknown> | null;
}

function ObjectionsSectionImpl({ entityType, entityId, rawPayload }: Props) {
  const [items, setItems] = useState<ObjectionLogRow[] | null>(null);
  const defaultPainId = detectPainId(rawPayload);

  // Chargement différé au mount / changement d'entité (calque du drawer).
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    getObjectionsForEntity(entityType, entityId).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <MessageSquareWarning className="h-3.5 w-3.5" />
        Objections
      </h2>

      <PermissionGate require="objections.create">
        <ObjectionLogger
          entityType={entityType}
          entityId={entityId}
          defaultPainId={defaultPainId}
          onLogged={(row) =>
            setItems((prev) => [row, ...(prev ?? [])])
          }
        />
      </PermissionGate>

      <div className="pt-1 border-t border-[var(--border)]">
        {items === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader className="h-3 w-3 animate-spin" />
            Chargement…
          </div>
        ) : (
          <ObjectionHistory
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

export const LeadObjectionsSection = React.memo(ObjectionsSectionImpl);
