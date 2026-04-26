"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export function GlobalBroadcastBanner() {
  const { t, dir } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/public/broadcast", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { message?: unknown };
        const m = String(j.message ?? "").trim();
        if (!cancelled) setMessage(m.length > 0 ? m : null);
      } catch {
        if (!cancelled) setMessage(null);
      }
    };
    void load();
    const iv = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      dir={dir}
      className="mb-6 rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm text-sky-50 shadow-lg shadow-sky-950/25 md:px-5 md:py-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-200/90">
            {t("globalAnnouncement")}
          </p>
          <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-white/95">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
