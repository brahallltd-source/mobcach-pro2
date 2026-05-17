"use client";

import { useEffect } from "react";
import { restoreSessionFromLocalToken } from "@/lib/client-session";

const RESTORE_ONCE_KEY = "mobcash_auth_restore_attempted_v1";

/**
 * Restores server auth cookies from persisted local token once per tab session.
 * This prevents "logged out after app resume" on WebView process restarts.
 */
export function AuthSessionRehydrator() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(RESTORE_ONCE_KEY) === "1") return;
    sessionStorage.setItem(RESTORE_ONCE_KEY, "1");
    void restoreSessionFromLocalToken();
  }, []);

  return null;
}
