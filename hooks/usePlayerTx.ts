"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

/** Dot-path under `messages/*.{lang}.json` → `player.*` (e.g. `dashboard.welcome`). */
export function usePlayerTx() {
  const { tx } = useTranslation();
  return useCallback(
    (path: string, vars?: Record<string, string>) => tx(`player.${path}`, vars),
    [tx]
  );
}
