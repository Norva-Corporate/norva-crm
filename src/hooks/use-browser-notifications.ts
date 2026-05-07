"use client";

import { useCallback, useEffect, useState } from "react";

type Permission = "default" | "granted" | "denied" | "unsupported";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<Permission>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as Permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
    }
  }, []);

  const notify = useCallback(
    (
      title: string,
      options?: NotificationOptions & { onClick?: () => void }
    ) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (document.visibilityState === "visible" && document.hasFocus()) return;
      try {
        const n = new Notification(title, options);
        if (options?.onClick) {
          n.onclick = () => {
            window.focus();
            options.onClick?.();
            n.close();
          };
        }
      } catch {
        // ignore
      }
    },
    []
  );

  return { permission, requestPermission, notify };
}
