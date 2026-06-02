"use client";
import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Mail,
  Phone,
  Building2,
  UserPlus,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Th, TableHeadRow, EmptyTableRow } from "@/components/ui/data-table";
import { RowActions } from "@/components/ui/row-actions";
import { ListPagination } from "@/components/ui/list-pagination";
import { deleteContact } from "@/lib/actions/contacts";
import { getInitials, formatDate, cn } from "@/lib/utils";
import type { Contact, Company } from "@/types";

type ContactRow = Contact & {
  company: { id: string; name: string } | null;
};

interface Props {
  initialContacts: ContactRow[];
  companies: Pick<Company, "id" | "name">[];
}

const PAGE_SIZE = 20;

export function ContactsClient({ initialContacts, companies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialContacts;
    return initialContacts.filter((c) => {
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.company?.name?.toLowerCase().includes(q)
      );
    });
  }, [initialContacts, search]);

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

  function openEdit(contact: ContactRow) {
    setEditing(contact);
    setDrawerOpen(true);
  }

  function handleDeleted() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteContact(deleting.id).then((res) => {
      if (res.success) {
        startTransition(() => router.refresh());
      }
      return res;
    });
  }

  return (
    <>
      <Header
        title="Contacts"
        action={{ label: "Nouveau contact", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contact…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} contact{filtered.length > 1 ? "s" : ""}
          </span>
          <ExportCsvButton
            rows={filtered}
            filenamePrefix="contacts"
            columns={[
              { header: "Prénom", get: (c) => c.first_name },
              { header: "Nom", get: (c) => c.last_name },
              { header: "Email", get: (c) => c.email },
              { header: "Téléphone", get: (c) => c.phone },
              { header: "Fonction", get: (c) => c.role },
              { header: "Entreprise", get: (c) => c.company?.name ?? "" },
              { header: "Notes", get: (c) => c.notes },
              { header: "Créé le", get: (c) => formatDate(c.created_at) },
            ]}
          />
        </div>

        {/* Mobile : liste de cartes */}
        <div className="md:hidden space-y-2">
          {paginated.length === 0 ? (
            <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
              <UserPlus className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              Aucun contact trouvé.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">
                Créer le premier
              </button>
            </Card>
          ) : (
            paginated.map((contact) => (
              <Card key={contact.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs bg-accent/15 text-accent">
                      {getInitials(`${contact.first_name} ${contact.last_name}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/contacts/${contact.id}`}
                      className="block"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.role && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {contact.role}
                        </p>
                      )}
                      <div className="space-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                        {contact.company && (
                          <p className="inline-flex items-center gap-1 truncate w-full">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contact.company.name}</span>
                          </p>
                        )}
                        {contact.email && (
                          <p className="inline-flex items-center gap-1 truncate w-full">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </p>
                        )}
                        {contact.phone && (
                          <p className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {contact.phone}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>
                  <RowActions
                    onEdit={() => openEdit(contact)}
                    onDelete={() => setDeleting(contact)}
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
                  <Th>Contact</Th>
                  <Th>Entreprise</Th>
                  <Th>Email</Th>
                  <Th>Téléphone</Th>
                  <Th>Rôle</Th>
                  <th className="w-10" />
                </TableHeadRow>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    icon={UserPlus}
                    label="Aucun contact trouvé."
                    cta={{ label: "Créer le premier", onClick: openCreate }}
                  />
                ) : (
                  paginated.map((contact, idx) => (
                    <tr
                      key={contact.id}
                      className={cn(
                        "border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]/30",
                        idx % 2 === 0
                          ? "bg-[#0B1220]"
                          : "bg-[#111927]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/contacts/${contact.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-accent/15 text-accent">
                              {getInitials(
                                `${contact.first_name} ${contact.last_name}`
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(contact.created_at)}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {contact.company ? (
                          <Link
                            href={`/dashboard/companies/${contact.company.id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-accent transition-colors"
                          >
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {contact.company.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contact.phone ? (
                          <span className="text-xs text-foreground inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {contact.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground">
                          {contact.role ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onEdit={() => openEdit(contact)}
                          onDelete={() => setDeleting(contact)}
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

        {/* Pagination — partagée mobile + desktop */}
        <ListPagination
          page={safePage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <ContactDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contact={editing}
        companies={companies}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="le contact"
        itemName={
          deleting ? `${deleting.first_name} ${deleting.last_name}` : ""
        }
        onConfirm={handleDeleted}
      />
    </>
  );
}
