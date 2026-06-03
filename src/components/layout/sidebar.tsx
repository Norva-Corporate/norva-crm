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
import type { Profile } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tâches", href: "/dashboard/taches", icon: CheckSquare },
  { label: "Calendrier", href: "/dashboard/calendrier", icon: CalendarDays },
  { label: "Campagnes", href: "/dashboard/campagnes", icon: Mail },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Entreprises", href: "/dashboard/companies", icon: Building2 },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
  { label: "Briefs", href: "/dashboard/briefs", icon: ClipboardList },
  { label: "Projets", href: "/dashboard/projets", icon: FolderKanban },
  { label: "Facturation", href: "/dashboard/facturation", icon: FileText },
  { label: "Reporting", href: "/dashboard/reporting", icon: BarChart3 },
  { label: "Objectifs", href: "/dashboard/objectifs", icon: Target },
  { label: "Intégrations", href: "/dashboard/integrations", icon: Plug },
];

interface SidebarProps {
  profile: Profile | null;
  collapsed: boolean;
  onToggle: () => void;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
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

  const isMobile = variant === "mobile";
  const effectiveCollapsed = isMobile ? false : collapsed;

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
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={effectiveCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center text-sm transition-colors group",
                // Variant mobile : items plus hauts pour confort tactile.
                isMobile ? "h-11" : "h-9",
                effectiveCollapsed ? "justify-center" : "gap-2.5 px-2.5",
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
              {!effectiveCollapsed && <span className="flex-1 truncate">{item.label}</span>}
            </Link>
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
                {profile?.role === "admin" ? "Administrateur" : "Membre"}
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
