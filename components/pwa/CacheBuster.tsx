"use client";

import { useEffect } from "react";

/**
 * Versioned cache buster:
 * - runs once per version
 * - unregisters all active service workers
 * - clears Cache Storage
 * - forces a single reload to fetch fresh assets
 */
const CACHE_BUSTER_VERSION = "2026-05-27-capacitor-launch-404";
const CACHE_BUSTER_KEY = "gs365_cache_buster_version";

export function CacheBuster() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const appliedVersion = localStorage.getItem(CACHE_BUSTER_KEY);
      if (appliedVersion === CACHE_BUSTER_VERSION) return;

      // Set first to guarantee one-time behavior and avoid refresh loops.
      localStorage.setItem(CACHE_BUSTER_KEY, CACHE_BUSTER_VERSION);
    } catch {
      // If storage is unavailable, do nothing to avoid potential loops.
      return;
    }

    const forceRefreshOnce = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(registrations.map((reg) => reg.unregister()));
        }

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
        }
      } finally {
        window.location.reload();
      }
    };

    void forceRefreshOnce();
  }, []);

  return null;
}
