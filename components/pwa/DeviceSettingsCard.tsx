"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Bell, BellRing } from "lucide-react";
import { GlassCard, Switch } from "@/components/ui";
import { useTranslation } from "@/lib/i18n";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/cn";

export function DeviceSettingsCard() {
  const { tx } = useTranslation();
  const {
    support,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribeLocal,
  } = usePushNotifications();

  const vapidConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
  const denied = permission === "denied";
  const unsupported = support !== "ready";
  const switchDisabled =
    isLoading || denied || unsupported || !vapidConfigured;

  const hint = useMemo(() => {
    if (denied) return tx("pwa.device.deniedHint");
    if (unsupported) return tx("pwa.device.unsupportedHint");
    if (!vapidConfigured) return tx("pwa.device.vapidMissingHint");
    if (error === "permission") return tx("pwa.device.deniedHint");
    return null;
  }, [denied, unsupported, vapidConfigured, error, tx]);

  const onToggle = useCallback(
    async (next: boolean) => {
      if (switchDisabled) return;
      if (next) {
        const ok = await subscribe();
        if (ok) toast.success(tx("pwa.device.enableToast"));
        else toast.error(tx("pwa.device.errorToast"));
      } else {
        await unsubscribeLocal();
        toast.success(tx("pwa.device.disableToast"));
      }
    },
    [subscribe, unsubscribeLocal, switchDisabled, tx],
  );

  return (
    <GlassCard className="border border-white/[0.08] bg-white/[0.04] p-6 shadow-xl backdrop-blur-xl md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5",
              isSubscribed && "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
            )}
          >
            {isSubscribed ? <BellRing className="h-6 w-6" strokeWidth={1.5} /> : <Bell className="h-6 w-6 text-white/80" strokeWidth={1.5} />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{tx("pwa.device.sectionTitle")}</h2>
            <p className="mt-1 text-sm text-white/55">{tx("pwa.device.sectionSubtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isSubscribed ? (
            <span className="hidden text-xs font-semibold uppercase tracking-wide text-emerald-300/90 sm:inline">
              {tx("pwa.device.activeHint")}
            </span>
          ) : null}
          <Switch
            checked={isSubscribed}
            onCheckedChange={(checked) => void onToggle(checked)}
            disabled={switchDisabled}
            aria-label={tx("pwa.device.pushLabel")}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">{tx("pwa.device.pushLabel")}</p>
            <p className="mt-1 text-sm text-white/55">
              {tx("pwa.device.description")}
            </p>
          </div>
        </div>
        {isSubscribed ? (
          <p className="mt-3 text-xs font-medium text-emerald-300/90 sm:hidden">{tx("pwa.device.activeHint")}</p>
        ) : null}
        {hint ? <p className="mt-3 text-sm text-amber-200/90">{hint}</p> : null}
      </div>
    </GlassCard>
  );
}
