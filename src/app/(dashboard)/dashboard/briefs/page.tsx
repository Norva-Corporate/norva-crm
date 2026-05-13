import React from "react";
import { Header } from "@/components/layout/header";
import { GenerateTokenDialog } from "@/components/briefs/generate-token-dialog";
import { BriefsClient } from "@/components/briefs/briefs-client";
import {
  listBriefs,
  listActiveTokens,
  listContactsForPicker,
  listCompaniesForPicker,
} from "@/lib/actions/briefs";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [briefs, tokens, contacts, companies] = await Promise.all([
    listBriefs(),
    listActiveTokens(),
    listContactsForPicker(),
    listCompaniesForPicker(),
  ]);

  const vitrineBaseUrl =
    process.env.VITRINE_BASE_URL ?? "https://norva-corporate.fr";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Briefs" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {/* Header section avec CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {briefs.length} brief{briefs.length > 1 ? "s" : ""} reçu
              {briefs.length > 1 ? "s" : ""} · {tokens.length} lien
              {tokens.length > 1 ? "s" : ""} actif
              {tokens.length > 1 ? "s" : ""}
            </p>
          </div>
          <GenerateTokenDialog contacts={contacts} companies={companies} />
        </div>

        <BriefsClient
          briefs={briefs}
          tokens={tokens}
          vitrineBaseUrl={vitrineBaseUrl}
        />
      </div>
    </div>
  );
}
