"use client";

import { useTranslation } from "@/lib/i18n";

/** Marketing / landing footer (year + attribution), respects active language. */
export function Footer() {
  const { tx } = useTranslation();
  return (
    <footer className="border-t border-white/[0.06] pt-10 pb-6 text-center text-sm text-muted-foreground">
      <p>{tx("home.footer.line1")}</p>
      <p className="mt-2 text-xs text-muted-foreground">{tx("home.footer.line2")}</p>
    </footer>
  );
}
