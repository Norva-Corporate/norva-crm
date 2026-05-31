"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Phone,
  MapPin,
  Calendar,
  Pencil,
  Trash2,
  ExternalLink,
  UserPlus,
  Building2,
  Users,
  Briefcase,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { CompanyDrawer } from "@/components/contacts/CompanyDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { EntityTags } from "@/components/tags/entity-tags";
import { deleteCompany, patchCompany, type CompanyPatch } from "@/lib/actions/contacts";
import { InlineText } from "@/components/ui/inline-text";
import { getInitials, formatCurrency, formatDate, cn } from "@/lib/utils";
import type {
  Company,
  Contact,
  DealStage,
  Tag,
} from "@/types";

interface DealRow {
  id: string;
  title: string;
  stage: DealStage;
  value: number | null;
  expected_close_date: string | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
}

interface Props {
  company: Company;
  contacts: Contact[];
  deals: DealRow[];
  tags?: Tag[];
}

const stageLabels: Record<DealStage, string> = {
  discussion: "Discussion",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

export function CompanyDetailClient({
  company,
  contacts,
  deals,
  tags = [],
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete() {
    return deleteCompany(company.id).then((res) => {
      if (res.success) {
        startTransition(() => router.push("/dashboard/companies"));
      }
      return res;
    });
  }

  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = deals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

  const patch =
    (field: keyof CompanyPatch) =>
    (value: string | null) =>
      patchCompany(company.id, { [field]: value } as CompanyPatch);

  return (
    <>
      <Header title="Fiche entreprise" />

      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-6">
        <Link
          href="/dashboard/companies"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour aux entreprises
        </Link>

        {/* En-tête */}
        <Card className="p-4 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
              <div className="h-12 w-12 md:h-16 md:w-16 bg-accent/15 flex items-center justify-center text-base md:text-lg font-semibold text-accent shrink-0">
                {getInitials(company.name)}
              </div>
              <div className="space-y-2 pt-1 min-w-0 flex-1">
                <div className="text-xl font-semibold text-foreground">
                  <InlineText
                    value={company.name}
                    onSave={patch("name")}
                    ariaLabel="Nom"
                    required
                    placeholder="Nom de l'entreprise"
                    className="max-w-[24rem]"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    Secteur :
                    <InlineText
                      value={company.sector}
                      onSave={patch("sector")}
                      ariaLabel="Secteur"
                      placeholder="Ajouter un secteur"
                      className="min-w-[6rem]"
                    />
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Taille :
                    <InlineText
                      value={company.size}
                      onSave={patch("size")}
                      ariaLabel="Taille"
                      placeholder="ex. 11-50"
                      className="min-w-[5rem]"
                    />
                  </span>
                </div>
                <EntityTags
                  entityType="company"
                  entityId={company.id}
                  initialTags={tags}
                />
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

        {/* Stats rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            icon={Users}
            label="Contacts"
            value={contacts.length.toString()}
          />
          <StatCard
            icon={Briefcase}
            label="Deals en cours"
            value={deals
              .filter((d) => d.stage !== "won" && d.stage !== "lost")
              .length.toString()}
          />
          <StatCard
            icon={Building2}
            label="Chiffre d'affaires gagné"
            value={formatCurrency(wonValue)}
            sub={
              totalValue !== wonValue
                ? `${formatCurrency(totalValue)} total pipeline`
                : undefined
            }
          />
        </div>

        {/* Adresse + créée le + notes */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Informations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <InfoRow icon={MapPin} label="Adresse">
              <InlineText
                value={company.address}
                onSave={patch("address")}
                ariaLabel="Adresse"
                placeholder="Ajouter une adresse"
                displayClassName="text-xs"
              />
            </InfoRow>
            <InfoRow icon={Globe} label="Site web">
              <InlineText
                value={company.website}
                onSave={patch("website")}
                ariaLabel="Site web"
                variant="url"
                placeholder="https://…"
                displayClassName="text-xs"
                displayAs={(v) => (
                  <a
                    href={v}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {v.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
              />
            </InfoRow>
            <InfoRow icon={Globe} label="Domaine">
              <InlineText
                value={company.domain}
                onSave={patch("domain")}
                ariaLabel="Domaine"
                placeholder="exemple.com"
                displayClassName="text-xs"
              />
            </InfoRow>
            <InfoRow icon={Phone} label="Téléphone">
              <InlineText
                value={company.phone}
                onSave={patch("phone")}
                ariaLabel="Téléphone"
                variant="tel"
                placeholder="+33 …"
                displayClassName="text-xs"
                displayAs={(v) => (
                  <a
                    href={`tel:${v}`}
                    className="text-foreground hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {v}
                  </a>
                )}
              />
            </InfoRow>
            <InfoRow icon={Calendar} label="Créée le">
              <span className="text-xs text-foreground">
                {formatDate(company.created_at)}
              </span>
            </InfoRow>
          </div>
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Notes
            </p>
            <InlineText
              value={company.notes}
              onSave={patch("notes")}
              ariaLabel="Notes"
              variant="textarea"
              placeholder="Ajouter des notes…"
              displayClassName="text-xs whitespace-pre-wrap"
              rows={5}
            />
          </div>
        </Card>

        {/* Contacts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Contacts
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {contacts.length} contact{contacts.length > 1 ? "s" : ""} dans cette entreprise
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContactDrawerOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Ajouter un contact
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Aucun contact rattaché.{" "}
              <button
                onClick={() => setContactDrawerOpen(true)}
                className="text-accent hover:underline"
              >
                Ajouter le premier
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link
                    href={`/dashboard/contacts/${contact.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      "border border-[var(--border)] hover:border-accent/40",
                      "bg-[var(--surface)] hover:bg-[var(--muted)]/30 transition-colors group"
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-[10px] bg-accent/15 text-accent">
                        {getInitials(
                          `${contact.first_name} ${contact.last_name}`
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {contact.role ?? contact.email ?? "—"}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Deals */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deals</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {deals.length} deal{deals.length > 1 ? "s" : ""}
                {totalValue > 0 && <> · {formatCurrency(totalValue)} cumulé</>}
              </p>
            </div>
          </div>

          {deals.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Aucun deal lié à cette entreprise.
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
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {deal.contact && (
                          <>
                            {deal.contact.first_name} {deal.contact.last_name} ·{" "}
                          </>
                        )}
                        {formatDate(deal.created_at)}
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

      <CompanyDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      <ContactDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        companies={[{ id: company.id, name: company.name }]}
        defaultCompanyId={company.id}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      <DeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemType="l'entreprise"
        itemName={company.name}
        description={
          contacts.length > 0 || deals.length > 0
            ? `${contacts.length} contact(s) et ${deals.length} deal(s) seront détachés.`
            : undefined
        }
        onConfirm={handleDelete}
      />
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">
            {value}
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
        <div className="h-7 w-7 bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-accent" />
        </div>
      </div>
    </Card>
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
