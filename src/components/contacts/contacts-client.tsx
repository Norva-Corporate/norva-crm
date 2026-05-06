"use client";
import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
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

      <div className="flex-1 p-6 animate-fade-in">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
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
        </div>

        {/* Tableau */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <Th>Contact</Th>
                  <Th>Entreprise</Th>
                  <Th>Email</Th>
                  <Th>Téléphone</Th>
                  <Th>Rôle</Th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-sm text-muted-foreground"
                    >
                      <UserPlus className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
                      Aucun contact trouvé.{" "}
                      <button
                        onClick={openCreate}
                        className="text-accent hover:underline"
                      >
                        Créer le premier
                      </button>
                    </td>
                  </tr>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(contact)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleting(contact)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <p className="text-xs text-muted-foreground">
                Page {safePage} sur {totalPages} —{" "}
                {(safePage - 1) * PAGE_SIZE + 1}-
                {Math.min(safePage * PAGE_SIZE, filtered.length)} sur{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
      {children}
    </th>
  );
}
