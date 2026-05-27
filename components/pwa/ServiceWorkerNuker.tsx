"use client";

import { useEffect } from "react";

/**
 * Force-unregister any stale service workers on client boot.
 * This helps recover APK/PWA clients that keep requesting legacy cached routes.
 */
export function ServiceWorkerNuker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
        }
      })
      .catch(() => {
        // Ignore errors to avoid blocking app startup.
      });
  }, []);

  return null;
}
