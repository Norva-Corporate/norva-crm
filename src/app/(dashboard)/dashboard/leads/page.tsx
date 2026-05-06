import React from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listLeads } from "@/lib/actions/leads";
import { LeadsClient } from "@/components/leads/leads-client";
import { WebhookConfig } from "@/components/leads/webhook-config";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [leads, { data: companies }, { data: profile }, h] = await Promise.all([
    listLeads(),
    supabase.from("companies").select("id, name").order("name"),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    headers(),
  ]);

  const protocol =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const webhookUrl = `${protocol}://${host}/api/webhooks/multica`;

  const secret = process.env.MULTICA_WEBHOOK_SECRET ?? null;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const isAdmin = profile?.role === "admin";

  const webhookConfig = (
    <WebhookConfig
      webhookUrl={webhookUrl}
      secretConfigured={!!secret}
      serviceRoleConfigured={!!serviceRole}
      secret={isAdmin ? secret : null}
    />
  );

  return (
    <div className="flex flex-col flex-1">
      <LeadsClient
        leads={leads}
        companies={companies ?? []}
        webhookConfig={webhookConfig}
      />
    </div>
  );
}
