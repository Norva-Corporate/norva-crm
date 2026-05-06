"use client";
import React, { useState } from "react";
import {
  Webhook,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  webhookUrl: string;
  secretConfigured: boolean;
  /** Secret value, only passed when current user is admin */
  secret?: string | null;
  serviceRoleConfigured: boolean;
}

export function WebhookConfig({
  webhookUrl,
  secretConfigured,
  secret,
  serviceRoleConfigured,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const ready = secretConfigured && serviceRoleConfigured;

  const examplePayload = `{
  "email": "jean.dupont@acme.com",
  "first_name": "Jean",
  "last_name": "Dupont",
  "phone": "+33 6 12 34 56 78",
  "role": "Directeur marketing",
  "company": "Acme",
  "domain": "acme.com",
  "id": "lead_abc123"
}`;

  const curlExample = `curl -X POST '${webhookUrl}' \\
  -H 'x-webhook-secret: <ton-secret>' \\
  -H 'Content-Type: application/json' \\
  -d '${examplePayload.replace(/\n/g, " ").replace(/\s+/g, " ")}'`;

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/30 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Webhook className="h-3.5 w-3.5 text-accent" />
        <span className="text-sm font-medium text-foreground">
          Configuration webhook
        </span>
        <span
          className={cn(
            "ml-auto text-[11px] px-1.5 py-0.5 rounded-sm",
            ready
              ? "text-success bg-success/10 border border-success/30"
              : "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30"
          )}
        >
          {ready ? "Prêt" : "À configurer"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 space-y-4 text-xs">
          {!ready && (
            <div className="flex items-start gap-2 px-3 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B] mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">
                  Variables d&apos;environnement manquantes
                </p>
                <ul className="text-muted-foreground space-y-0.5">
                  {!secretConfigured && (
                    <li>
                      <code className="font-mono">MULTICA_WEBHOOK_SECRET</code>{" "}
                      — défini par toi, à mettre aussi côté agent multica
                    </li>
                  )}
                  {!serviceRoleConfigured && (
                    <li>
                      <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                      — copié depuis Supabase Dashboard → Settings → API
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* URL */}
          <Field label="URL du webhook" value={webhookUrl} field="url" copiedField={copiedField} onCopy={copy} mono />

          {/* Method */}
          <div className="grid grid-cols-2 gap-3">
            <FieldStatic label="Méthode" value="POST" />
            <FieldStatic label="Content-Type" value="application/json" />
          </div>

          {/* Secret */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Header d&apos;authentification
            </p>
            <div className="flex items-stretch gap-1.5">
              <code className="flex-1 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] font-mono text-foreground break-all">
                x-webhook-secret:{" "}
                {secret == null ? (
                  <span className="text-muted-foreground italic">
                    {secretConfigured
                      ? "•••••••••••••••• (visible uniquement en mode admin)"
                      : "non configuré"}
                  </span>
                ) : showSecret ? (
                  secret
                ) : (
                  "•".repeat(Math.min(secret.length, 24))
                )}
              </code>
              {secret != null && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setShowSecret((s) => !s)}
                    title={showSecret ? "Masquer" : "Afficher"}
                  >
                    {showSecret ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copy(secret, "secret")}
                    title="Copier"
                  >
                    {copiedField === "secret" ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Example payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Exemple de payload
              </p>
              <button
                type="button"
                onClick={() => copy(examplePayload, "payload")}
                className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
              >
                {copiedField === "payload" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copier
              </button>
            </div>
            <pre className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] font-mono text-foreground overflow-x-auto whitespace-pre">
              {examplePayload}
            </pre>
          </div>

          {/* cURL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Exemple cURL
              </p>
              <button
                type="button"
                onClick={() => copy(curlExample, "curl")}
                className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
              >
                {copiedField === "curl" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copier
              </button>
            </div>
            <pre className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {curlExample}
            </pre>
          </div>

          <div className="space-y-1 text-muted-foreground leading-relaxed">
            <p>
              <span className="text-foreground font-medium">Source :</span> le
              champ <code className="font-mono">source</code> par défaut est{" "}
              <code className="font-mono">multica</code>. Pour distinguer
              plusieurs agents ou outils, ajoute{" "}
              <code className="font-mono">?source=mon-agent</code> à l&apos;URL ou
              le header <code className="font-mono">x-source: mon-agent</code>.
            </p>
            <p>
              <span className="text-foreground font-medium">Format :</span>{" "}
              accepte un objet seul, un tableau{" "}
              <code className="font-mono">[…]</code>, ou un objet{" "}
              <code className="font-mono">{`{ leads: […] }`}</code>. Les champs
              sont extraits avec des alias FR/EN courants (
              <code className="font-mono">email</code>,{" "}
              <code className="font-mono">first_name</code>,{" "}
              <code className="font-mono">prenom</code>,{" "}
              <code className="font-mono">company</code>,{" "}
              <code className="font-mono">entreprise</code>, etc.). Le payload
              brut est conservé.
            </p>
            <p>
              <span className="text-foreground font-medium">Idempotence :</span>{" "}
              passe un identifiant stable dans{" "}
              <code className="font-mono">id</code>,{" "}
              <code className="font-mono">lead_id</code> ou{" "}
              <code className="font-mono">external_id</code> — un même lead
              n&apos;est inséré qu&apos;une fois par <code>source</code>.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  field,
  copiedField,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (value: string, field: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex items-stretch gap-1.5">
        <code
          className={cn(
            "flex-1 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-foreground break-all",
            mono && "font-mono"
          )}
        >
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onCopy(value, field)}
          title="Copier"
        >
          {copiedField === field ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldStatic({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <code className="block px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] font-mono text-foreground">
        {value}
      </code>
    </div>
  );
}
