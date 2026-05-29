import React from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { ContratsSection } from "@/components/contrats/ContratsSection";

export const dynamic = "force-dynamic";

export default async function ContratsPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Contrats" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        <div>
          <p className="text-xs text-muted-foreground">
            Génère, envoie et signe électroniquement les contrats de
            prestation via Yousign.
          </p>
        </div>

        <Card className="p-4 md:p-6">
          <ContratsSection scope={{ type: "all" }} />
        </Card>
      </div>
    </div>
  );
}
