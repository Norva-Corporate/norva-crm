import { redirect } from "next/navigation";
import { CalendarDays, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationActions } from "@/components/integrations/integrations-client";

export const metadata = {
  title: "Intégrations · norva CRM",
};

interface IntegrationRow {
  google_account_email: string | null;
  google_calendar_id: string | null;
  scope: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  connected_at: string;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: integration } = await supabase
    .from("user_integrations")
    .select(
      "google_account_email, google_calendar_id, scope, last_sync_at, last_sync_error, connected_at"
    )
    .eq("user_id", user.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const row = integration as IntegrationRow | null;
  const isConnected = !!row;
  const needsReauth = row?.last_sync_error === "reauth_required";
  const hasDriveScope = (row?.scope ?? "").includes(DRIVE_SCOPE);

  const params = await searchParams;
  const flashStatus = params.status;

  return (
    <>
      <Header title="Intégrations" />
      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
      <header>
        <h1 className="text-lg md:text-xl font-semibold tracking-tight">Intégrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez vos outils externes pour synchroniser les données du CRM.
        </p>
      </header>

      {flashStatus === "connected" && (
        <div className="flex items-center gap-2 border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Google Calendar connecté avec succès. Le calendrier "Norva CRM" a été
          créé dans votre compte Google.
        </div>
      )}
      {flashStatus && flashStatus !== "connected" && (
        <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          La connexion a échoué : <code className="text-xs">{flashStatus}</code>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 flex items-center justify-center bg-accent/10 text-accent">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Google Calendar + Drive</CardTitle>
                <CardDescription>
                  <strong>Calendar</strong> — Publie les échéances de deals,
                  tâches, projets et factures dans un calendrier dédié{" "}
                  <em>Norva CRM</em>.
                  <br />
                  <strong>Drive</strong> — Crée à la demande un dossier
                  structuré (Brief / Devis / Contrat) par deal ou projet, depuis
                  son drawer.
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              needsReauth ? (
                <Badge variant="destructive">Reconnexion requise</Badge>
              ) : (
                <Badge variant="success">Connecté</Badge>
              )
            ) : (
              <Badge variant="outline">Non connecté</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 text-sm">
          {isConnected && row && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Compte Google
                  </div>
                  <div className="font-medium text-foreground">
                    {row.google_account_email ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Connecté le
                  </div>
                  <div className="font-medium text-foreground">
                    {formatDateTime(row.connected_at)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Dernière synchro
                  </div>
                  <div className="font-medium text-foreground">
                    {formatDateTime(row.last_sync_at)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    ID calendrier
                  </div>
                  <div className="font-mono text-xs text-foreground/70 truncate">
                    {row.google_calendar_id ?? "—"}
                  </div>
                </div>
              </div>

              {row.last_sync_error && (
                <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Erreur de synchronisation
                  </div>
                  <p className="mt-1 text-xs font-mono">
                    {row.last_sync_error === "reauth_required"
                      ? "Le token Google a été révoqué. Reconnectez votre compte pour reprendre la synchronisation."
                      : row.last_sync_error}
                  </p>
                </div>
              )}

              {!hasDriveScope && !needsReauth && (
                <div className="border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Drive non autorisé
                  </div>
                  <p className="mt-1 text-xs">
                    Votre connexion couvre Calendar mais pas Drive. Reconnectez
                    votre compte Google pour activer la création de dossiers
                    Drive depuis les drawers Deal / Projet.
                  </p>
                </div>
              )}
            </>
          )}

          {!isConnected && (
            <p className="text-sm text-muted-foreground">
              Une fois connecté, le CRM créera un calendrier <em>Norva CRM</em>{" "}
              dans votre Google Calendar et y publiera tous les événements
              datés. Synchronisation à sens unique : les modifications dans
              Google Calendar ne reviennent pas dans le CRM.
            </p>
          )}
        </CardContent>

        <CardFooter>
          <IntegrationActions isConnected={isConnected} />
        </CardFooter>
      </Card>
      </div>
    </>
  );
}
