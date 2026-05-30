import { Suspense } from "react";
import { CampagnesClient } from "@/components/campagnes/campagnes-client";
import { listPendingCampaigns, getProspectionSettings } from "@/lib/actions/campagnes";

export const metadata = { title: "Campagnes email | Norva" };

export default async function CampagnesPage() {
  const [campaigns, settings] = await Promise.all([
    listPendingCampaigns(),
    getProspectionSettings(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Campagnes email</h1>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} email{campaigns.length !== 1 ? "s" : ""} en attente de validation
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Chargement...</div>}>
        <CampagnesClient campaigns={campaigns} settings={settings} />
      </Suspense>
    </div>
  );
}
