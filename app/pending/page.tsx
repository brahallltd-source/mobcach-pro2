"use client";

import { useEffect, useMemo, useState } from "react";
import { DangerButton, GlassCard, Shell, StatCard } from "@/components/ui";
import { useTranslation } from "@/lib/i18n";

const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function deadlineStorageKey(): string {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("mobcash_user") : null;
    if (raw) {
      const u = JSON.parse(raw) as { id?: string };
      if (u?.id && typeof u.id === "string") return `mobcash_pending_window_end_${u.id}`;
    }
  } catch {
    /* ignore */
  }
  return "mobcash_pending_window_end";
}

function PendingCountdown() {
  const { t } = useTranslation();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const key = deadlineStorageKey();
    let end = 0;
    try {
      const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed) && parsed > Date.now()) {
        end = parsed;
      } else {
        end = Date.now() + REVIEW_WINDOW_MS;
        window.sessionStorage.setItem(key, String(end));
      }
    } catch {
      end = Date.now() + REVIEW_WINDOW_MS;
    }

    const tick = () => {
      setRemainingMs(Math.max(0, end - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = useMemo(() => {
    if (remainingMs === null) {
      return { h: 48, m: 0, s: 0 };
    }
    const totalSec = Math.floor(remainingMs / 1000);
    return {
      h: Math.floor(totalSec / 3600),
      m: Math.floor((totalSec % 3600) / 60),
      s: totalSec % 60,
    };
  }, [remainingMs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label={t("pendingHours")} value={pad2(parts.h)} />
        <StatCard label={t("pendingMinutes")} value={pad2(parts.m)} />
        <StatCard label={t("pendingSeconds")} value={pad2(parts.s)} />
      </div>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("pendingWindowHint")}</p>
    </div>
  );
}

export default function PendingApplicationPage() {
  const { t } = useTranslation();

  function handleLogout() {
    const deadlineKey = typeof window !== "undefined" ? deadlineStorageKey() : "";
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.removeItem(deadlineKey);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem("mobcash_user");
      } catch {
        /* ignore */
      }
      window.location.href = "/login";
    });
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-8">
        <GlassCard className="p-6 md:p-8">
          <div className="flex flex-col items-center text-center">
            <div
              className="text-6xl font-extrabold text-primary animate-pulse mb-6 tracking-widest"
              aria-hidden
            >
              48H
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
              {t("pendingApprovalTitle")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 md:text-base">
              {t("pendingApprovalSubtitle")}
            </p>
          </div>
          <div className="mt-8">
            <PendingCountdown />
          </div>
          <div className="mt-8 flex justify-center">
            <DangerButton type="button" className="w-full max-w-sm" onClick={handleLogout}>
              تسجيل الخروج
            </DangerButton>
          </div>
        </GlassCard>
      </div>
    </Shell>
  );
}
