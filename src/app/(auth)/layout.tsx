import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center px-4 py-10">
      <Link
        href="/"
        className="text-2xl font-semibold text-foreground tracking-tight mb-12"
      >
        norva<span className="text-accent">.</span>
      </Link>

      <div className="w-full max-w-sm flex-1 flex items-start justify-center">
        {children}
      </div>

      <p className="text-[10px] text-muted-foreground mt-10 opacity-60">
        norva CRM · Agence Prime
      </p>
    </div>
  );
}
