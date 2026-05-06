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
  CheckSquare,
  CalendarDays,
  BarChart3,
  UserCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Entreprises", href: "/dashboard/companies", icon: Building2 },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
  { label: "Projets", href: "/dashboard/projets", icon: FolderKanban },
  { label: "Facturation", href: "/dashboard/facturation", icon: FileText },
  { label: "Reporting", href: "/dashboard/reporting", icon: BarChart3 },
];

interface SidebarProps {
  profile: Profile | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ profile, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const isProfilActive = pathname.startsWith("/dashboard/profil");

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] fixed left-0 top-0 z-40 transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo + toggle */}
      <div
        className={cn(
          "flex items-center h-14 border-b border-[var(--sidebar-border)]",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="text-base font-semibold text-foreground tracking-tight"
          >
            norva<span className="text-accent">.</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="text-[var(--sidebar-muted)] hover:text-foreground transition-colors"
          title={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
          aria-label={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
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
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center h-9 text-sm transition-colors group",
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
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: profil link + user + logout */}
      <div className="border-t border-[var(--sidebar-border)] p-2 space-y-1">
        <Link
          href="/dashboard/profil"
          title={collapsed ? "Profil" : undefined}
          className={cn(
            "flex items-center h-9 text-sm transition-colors",
            collapsed ? "justify-center" : "gap-2.5 px-2.5",
            isProfilActive
              ? "bg-accent/15 text-accent"
              : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5"
          )}
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Profil</span>}
        </Link>

        <div
          className={cn(
            "flex items-center mt-1 pt-2 border-t border-[var(--sidebar-border)]",
            collapsed ? "flex-col gap-2 py-2" : "gap-2.5 px-1 py-2"
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile?.full_name ? getInitials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
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
