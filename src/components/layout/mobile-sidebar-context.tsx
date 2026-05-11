"use client";

import { createContext, useContext } from "react";

interface MobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null);

export function useMobileSidebar(): MobileSidebarContextValue {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    return { open: false, setOpen: () => {} };
  }
  return ctx;
}
