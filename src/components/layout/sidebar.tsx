"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  FolderKanban,
  FileText,
  ClipboardList,
  CheckSquare,
  CalendarDays,
  BarChart3,
  UserCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Mail,
  Target,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logoutAction } from "@/app/(auth)/actions";
import { usePermission } from "@/hooks/use-permission";
import { usePermissionsContext } from "@/components/permissions/permissions-provider";
import type { PermissionKey } from "@/lib/permissions/catalog";
import type { Profile } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Permission requise pour voir ce lien dans la sidebar. Le tableau de
   * bord (`/dashboard`) n'a pas de permission requise — il est toujours
   * accessible.
   */
  permission?: PermissionKey;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tâches", href: "/dashboard/taches", icon: CheckSquare, permission: "tasks.read" },
  { label: "Calendrier", href: "/dashboard/calendrier", icon: CalendarDays },
  { label: "Campagnes", href: "/dashboard/campagnes", icon: Mail, permission: "campaigns.read" },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users, permission: "contacts.read" },
  { label: "Entreprises", href: "/dashboard/companies", icon: Building2, permission: "companies.read" },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Kanban, permission: "deals.read" },
  { label: "Briefs", href: "/dashboard/briefs", icon: ClipboardList, permission: "briefs.read" },
  { label: "Projets", href: "/dashboard/projets", icon: FolderKanban, permission: "projects.read" },
  { label: "Facturation", href: "/dashboard/facturation", icon: FileText, permission: "invoices.read" },
  { label: "Reporting", href: "/dashboard/reporting", icon: BarChart3, permission: "reporting.read" },
  { label: "Objectifs", href: "/dashboard/objectifs", icon: Target, permission: "goals.read" },
  { label: "Intégrations", href: "/dashboard/integrations", icon: Plug, permission: "integrations.read" },
];

interface SidebarProps {
  profile: Profile | null;
  collapsed: boolean;
  onToggle: () => void;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

/**
 * Wrapper qui décide d'afficher ou non un item de navigation en fonction
 * de la permission requise. On ne peut pas appeler `usePermission` dans
 * un `.map()` conditionnel (règle des hooks), donc on isole chaque item
 * dans un composant.
 */
function NavLink({
  item,
  isActive,
  collapsed,
  isMobile,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  isMobile: boolean;
  onClick?: () => void;
}) {
  // Item sans permission requise : toujours visible.
  // Sinon : on consulte le hook (qui retourne true pour les admins système).
  const allowed = item.permission ? usePermission(item.permission) : true;
  if (!allowed) return null;

  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center text-sm transition-colors group",
        isMobile ? "h-11" : "h-9",
        collapsed ? "justify-center" : "gap-2.5 px-2.5",
        isActive
          ? "bg-accent/15 text-accent"
          : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive
            ? "text-accent"
            : "text-[var(--sidebar-muted)] group-hover:text-foreground"
        )}
      />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  );
}

/**
 * Libellé affiché pour le rôle de l'utilisateur. Mapping français pour les
 * rôles système ; pour les rôles custom, on capitalise la `roleKey`.
 */
function formatRoleLabel(roleKey: string | null): string {
  if (!roleKey) return "—";
  if (roleKey === "admin") return "Administrateur";
  if (roleKey === "member") return "Membre";
  return roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
}

export function Sidebar({
  profile,
  collapsed,
  onToggle,
  variant = "desktop",
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const isProfilActive = pathname.startsWith("/dashboard/profil");
  const { roleKey } = usePermissionsContext();

  const isMobile = variant === "mobile";
  const effectiveCollapsed = isMobile ? false : collapsed;

  // Le rôle affiché : on prend en priorité la roleKey du context (toujours
  // à jour avec les rôles custom), sinon on retombe sur profile.role.
  const displayedRoleKey = roleKey ?? profile?.role ?? null;

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-[var(--sidebar)] transition-[width] duration-200",
        isMobile
          ? "w-full h-full"
          : [
              "border-r border-[var(--sidebar-border)] fixed left-0 top-0 z-40",
              effectiveCollapsed ? "w-16" : "w-56",
            ]
      )}
    >
      {/* Logo + toggle */}
      <div
        className={cn(
          "flex items-center h-14 border-b border-[var(--sidebar-border)]",
          effectiveCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        {!effectiveCollapsed && (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="text-base font-semibold text-foreground tracking-tight"
          >
            norva<span className="text-accent">.</span>
          </Link>
        )}
        {!isMobile && (
          <button
            type="button"
            onClick={onToggle}
            className="text-[var(--sidebar-muted)] hover:text-foreground transition-colors"
            title={effectiveCollapsed ? "Déplier la sidebar" : "Replier la sidebar"}
            aria-label={effectiveCollapsed ? "Déplier la sidebar" : "Replier la sidebar"}
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <NavLink
              key={item.href}
              item={item}
              isActive={isActive}
              collapsed={effectiveCollapsed}
              isMobile={isMobile}
              onClick={onNavigate}
            />
          );
        })}
      </nav>

      {/* Bottom: profil link + user + logout */}
      <div className="border-t border-[var(--sidebar-border)] p-2 space-y-1">
        <Link
          href="/dashboard/profil"
          onClick={onNavigate}
          title={effectiveCollapsed ? "Profil" : undefined}
          className={cn(
            "flex items-center text-sm transition-colors",
            isMobile ? "h-11" : "h-9",
            effectiveCollapsed ? "justify-center" : "gap-2.5 px-2.5",
            isProfilActive
              ? "bg-accent/15 text-accent"
              : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5"
          )}
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          {!effectiveCollapsed && <span>Profil</span>}
        </Link>

        <div
          className={cn(
            "flex items-center mt-1 pt-2 border-t border-[var(--sidebar-border)]",
            effectiveCollapsed ? "flex-col gap-2 py-2" : "gap-2.5 px-1 py-2"
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile?.full_name ? getInitials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>

          {!effectiveCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {profile?.full_name ?? profile?.email ?? "Utilisateur"}
              </p>
              <p className="text-[10px] text-[var(--sidebar-muted)] truncate">
                {formatRoleLabel(displayedRoleKey)}
              </p>
            </div>
          )}

          <form action={logoutAction}>
            <button
              type="submit"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="text-[var(--sidebar-muted)] hover:text-destructive transition-colors p-1"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
