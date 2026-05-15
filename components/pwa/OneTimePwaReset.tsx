"use client";

import { useEffect } from "react";

/**
 * Emergency one-time PWA cache reset for returning clients that may be stuck
 * on stale/broken service worker caches after a bad deployment.
 */
const RESET_KEY = "pwa_cache_reset_v1_done";

export function OneTimePwaReset() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem(RESET_KEY) === "1") return;
      // Set first to guarantee no reload loop even if cleanup throws.
      localStorage.setItem(RESET_KEY, "1");
    } catch {
      // If storage is blocked, fail closed (avoid potential reload loops).
      return;
    }

    const runReset = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(regs.map((reg) => reg.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.allSettled(keys.map((key) => caches.delete(key)));
        }
      } finally {
        // Force one fresh bootstrap request after reset.
        (
          window.location as Location & {
            reload: (forcedReload?: boolean) => void;
          }
        ).reload(true);
      }
    };

    void runReset();
  }, []);

  return null;
}
