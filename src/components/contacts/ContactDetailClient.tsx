"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { deleteContact } from "@/lib/actions/contacts";
import { getInitials, formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Contact, Company, DealStage } from "@/types";

interface DealRow {
  id: string;
  title: string;
  stage: DealStage;
  value: number | null;
  expected_close_date: string | null;
  created_at: string;
}

interface Props {
  contact: Contact & { company: Company | null };
  deals: DealRow[];
  companies: { id: string; name: string }[];
}

const stageLabels: Record<DealStage, string> = {
  prospect: "Prospect",
  qualified: "Qualifié",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

export function ContactDetailClient({ contact, deals, companies }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete() {
    return deleteContact(contact.id).then((res) => {
      if (res.success) {
        startTransition(() => router.push("/dashboard/contacts"));
      }
      return res;
    });
  }

  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <>
      <Header title="Fiche contact" />

      <div className="flex-1 p-6 animate-fade-in space-y-6">
        {/* Retour */}
        <Link
          href="/dashboard/contacts"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour aux contacts
        </Link>

        {/* En-tête */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-accent/15 text-accent font-semibold">
                  {getInitials(`${contact.first_name} ${contact.last_name}`)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {contact.first_name} {contact.last_name}
                </h2>
                {contact.role && (
                  <p className="text-sm text-muted-foreground">
                    {contact.role}
                  </p>
                )}
                {contact.company && (
                  <Link
                    href={`/dashboard/companies/${contact.company.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    <Building2 className="h-3 w-3" />
                    {contact.company.name}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Grille infos + deals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Infos */}
          <Card className="p-5 lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Informations
            </h3>
            <dl className="space-y-3">
              <InfoRow icon={Mail} label="Email">
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow icon={Phone} label="Téléphone">
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-xs text-foreground hover:text-accent"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow icon={Building2} label="Entreprise">
                {contact.company ? (
                  <Link
                    href={`/dashboard/companies/${contact.company.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow icon={Calendar} label="Créé le">
                <span className="text-xs text-foreground">
                  {formatDate(contact.created_at)}
                </span>
              </InfoRow>
            </dl>

            {contact.notes && (
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Notes
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Deals */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Deals associés
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {deals.length} deal{deals.length > 1 ? "s" : ""}
                  {totalValue > 0 && (
                    <> · {formatCurrency(totalValue)} cumulé</>
                  )}
                </p>
              </div>
            </div>

            {deals.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucun deal associé à ce contact.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/dashboard/pipeline?deal=${deal.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-2.5",
                        "border border-[var(--border)] hover:border-accent/40",
                        "bg-[var(--surface)] hover:bg-[var(--muted)]/30 transition-colors group"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                            {deal.title}
                          </p>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDate(deal.created_at)}
                          {deal.expected_close_date && (
                            <> · Clôture prévue : {formatDate(deal.expected_close_date)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {deal.value != null && (
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {formatCurrency(deal.value)}
                          </span>
                        )}
                        <Badge variant={deal.stage}>
                          {stageLabels[deal.stage]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ContactDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        companies={companies}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      <DeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemType="le contact"
        itemName={`${contact.first_name} ${contact.last_name}`}
        description={
          deals.length > 0
            ? `${deals.length} deal(s) associé(s) seront détachés.`
            : undefined
        }
        onConfirm={handleDelete}
      />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </dt>
        <dd className="leading-tight">{children}</dd>
      </div>
    </div>
  );
}
