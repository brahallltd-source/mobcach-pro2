"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTranslation } from "@/lib/i18n";

type PushEngagementAlertProps = {
  role: "agent" | "player";
};

export function PushEngagementAlert({ role }: PushEngagementAlertProps) {
  const { tx } = useTranslation();
  const { isSubscribed, isLoading, subscribe, permission } = usePushNotifications();
  const storageKey = useMemo(() => `push_engagement_dismissed_${role}`, [role]);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore storage failures */
    }
    setDismissed(true);
  };

  const openSettings = () => {
    const target =
      role === "agent"
        ? "/agent/settings/general?highlightPush=1"
        : "/player/profile?highlightPush=1";
    window.location.href = target;
  };

  const onEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast.success(tx("notifications.prompt_enable_success"));
      dismiss();
      return;
    }
    if (permission === "denied") {
      toast.error(tx("notifications.prompt_enable_denied"));
    } else {
      toast.error(tx("notifications.prompt_enable_fallback"));
    }
    openSettings();
  };

  if (dismissed || isSubscribed) return null;

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-2 text-emerald-300">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {tx("notifications.prompt_title")}
            </p>
            <button
              type="button"
              onClick={() => void onEnable()}
              disabled={isLoading}
              className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30 disabled:opacity-60"
            >
              {isLoading ? tx("notifications.prompt_loading") : tx("notifications.prompt_button")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-1.5 text-emerald-200/90 hover:bg-emerald-500/20"
          aria-label={tx("notifications.prompt_dismiss_aria")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
