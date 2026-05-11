"use client";

import { useEffect, useState, useTransition } from "react";

export interface UseInlineOptimisticResult<T> {
  value: T;
  isPending: boolean;
  setOptimistic: (next: T) => void;
  startTransition: React.TransitionStartFunction;
}

export function useInlineOptimistic<T>(
  propValue: T
): UseInlineOptimisticResult<T> {
  const [isPending, startTransition] = useTransition();
  const [override, setOverride] = useState<{ value: T } | null>(null);

  useEffect(() => {
    if (!isPending) setOverride(null);
  }, [isPending]);

  return {
    value: override ? override.value : propValue,
    isPending,
    setOptimistic: (next: T) => setOverride({ value: next }),
    startTransition,
  };
}
