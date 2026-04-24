"use client";

import { useEffect } from "react";

const DEFAULT_PRIMARY = "#0f172a";

type Props = {
  primaryColor: string;
};

/** Applies `--primary` on `document.documentElement` from server-fetched settings (and updates on prop change after `router.refresh()`). */
export function BrandingStyleVars({ primaryColor }: Props) {
  useEffect(() => {
    const raw = String(primaryColor || "").trim();
    const safe = /^#[0-9A-Fa-f]{3,8}$/.test(raw) ? raw : DEFAULT_PRIMARY;
    document.documentElement.style.setProperty("--primary", safe);
  }, [primaryColor]);

  return null;
}
