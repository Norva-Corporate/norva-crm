"use client";
import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Globe,
  Phone,
  Building2,
  Users,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanyDrawer } from "@/components/contacts/CompanyDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { Th, TableHeadRow, EmptyTableRow } from "@/components/ui/data-table";
import { RowActions } from "@/components/ui/row-actions";
import { ListPagination } from "@/components/ui/list-pagination";
import { deleteCompany } from "@/lib/actions/contacts";
import { getInitials, cn } from "@/lib/utils";
import type { Company } from "@/types";

type CompanyRow = Company & { contacts_count: number };

interface Props {
  initialCompanies: CompanyRow[];
}

const PAGE_SIZE = 20;

export function CompaniesClient({ initialCompanies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<CompanyRow | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialCompanies;
    return initialCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sector?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.website?.toLowerCase().includes(q)
    );
  }, [initialCompanies, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setDrawerOpen(true);
  }

  function handleDeleted() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteCompany(deleting.id).then((res) => {
      if (res.success) {
        startTransition(() => router.refresh());
      }
      return res;
    });
  }

  return (
    <>
      <Header
        title="Entreprises"
        action={{ label: "Nouvelle entreprise", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher une entreprise…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} entreprise{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Mobile : liste de cartes */}
        <div className="md:hidden space-y-2">
          {paginated.length === 0 ? (
            <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              Aucune entreprise trouvée.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">
                Créer la première
              </button>
            </Card>
          ) : (
            paginated.map((company) => (
              <Card key={company.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 bg-accent/15 flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                    {getInitials(company.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/companies/${company.id}`}
                      className="block"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {company.name}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {company.sector && (
                          <Badge variant="default" className="text-[10px]">
                            {company.sector}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {company.contacts_count}
                        </span>
                      </div>
                      <div className="space-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                        {company.website && (
                          <p className="inline-flex items-center gap-1 truncate w-full">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {company.website
                                .replace(/^https?:\/\//, "")
                                .replace(/\/$/, "")}
                            </span>
                          </p>
                        )}
                        {company.phone && (
                          <p className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {company.phone}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>
                  <RowActions
                    onEdit={() => openEdit(company)}
                    onDelete={() => setDeleting(company)}
                  />
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Desktop : tableau */}
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <TableHeadRow>
                  <Th>Entreprise</Th>
                  <Th>Secteur</Th>
                  <Th>Contacts</Th>
                  <Th>Site web</Th>
                  <Th>Téléphone</Th>
                  <th className="w-10" />
                </TableHeadRow>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    icon={Building2}
                    label="Aucune entreprise trouvée."
                    cta={{ label: "Créer la première", onClick: openCreate }}
                  />
                ) : (
                  paginated.map((company, idx) => (
                    <tr
                      key={company.id}
                      className={cn(
                        "border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]/30",
                        idx % 2 === 0
                          ? "bg-[#0B1220]"
                          : "bg-[#111927]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/companies/${company.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="h-7 w-7 bg-accent/15 flex items-center justify-center text-[10px] font-semibold text-accent">
                            {getInitials(company.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                              {company.name}
                            </p>
                            {company.size && (
                              <p className="text-[10px] text-muted-foreground">
                                {company.size} employés
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {company.sector ? (
                          <Badge variant="default" className="text-[10px]">
                            {company.sector}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground inline-flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {company.contacts_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {company.phone ? (
                          <span className="text-xs text-foreground inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {company.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onEdit={() => openEdit(company)}
                          onDelete={() => setDeleting(company)}
                          stopPropagation={false}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <ListPagination
          page={safePage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <CompanyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        company={editing}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="l'entreprise"
        itemName={deleting?.name ?? ""}
        description={
          deleting && deleting.contacts_count > 0
            ? `${deleting.contacts_count} contact(s) associé(s) seront détachés.`
            : undefined
        }
        onConfirm={handleDeleted}
      />
    </>
  );
}
