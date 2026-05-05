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
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Entreprises", href: "/dashboard/companies", icon: Building2 },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
  { label: "Projets", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Facturation", href: "/dashboard/billing", icon: FileText },
];

interface SidebarProps {
  profile: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <aside className="flex h-screen w-56 flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[var(--sidebar-border)]">
        <div className="h-7 w-7 bg-accent flex items-center justify-center">
          <span className="text-white text-xs font-bold">N</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">norva CRM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
              className={cn(
                "flex items-center gap-2.5 px-2.5 h-8 text-sm transition-colors group",
                isActive
                  ? "bg-accent/15 text-accent border-l-2 border-accent -ml-px pl-[9px]"
                  : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-accent" : "text-[var(--sidebar-muted)] group-hover:text-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--sidebar-border)] p-3 space-y-0.5">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 h-8 text-sm transition-colors",
            pathname.startsWith("/dashboard/settings")
              ? "bg-accent/15 text-accent"
              : "text-[var(--sidebar-muted)] hover:text-foreground hover:bg-white/5"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Paramètres
        </Link>

        {/* User */}
        <div className="flex items-center gap-2.5 px-2.5 h-10 mt-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile?.full_name ? getInitials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {profile?.full_name ?? profile?.email ?? "Utilisateur"}
            </p>
            <p className="text-[10px] text-[var(--sidebar-muted)] truncate">
              {profile?.role === "admin" ? "Administrateur" : "Membre"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[var(--sidebar-muted)] hover:text-destructive transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
