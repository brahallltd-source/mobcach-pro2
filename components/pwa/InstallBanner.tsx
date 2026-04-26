"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "pwa_install_banner_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function InstallBanner() {
  const { tx } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const showIos = useMemo(() => isIos() && !isStandalone(), []);
  const showChromeInstall = Boolean(deferredPrompt) && !isIos();

  if (dismissed === null) return null;
  if (dismissed) return null;
  if (!showIos && !showChromeInstall) return null;

  const onInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice?.catch(() => undefined);
    } catch {
      /* ignore */
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 bottom-0 z-[100] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-auto md:right-4 md:max-w-md md:p-0 md:pb-4",
      )}
      role="region"
      aria-label={tx("pwa.installBanner.title")}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl",
          "ring-1 ring-white/10",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(168,85,247,0.1),transparent_50%)]" />
        <button
          type="button"
          onClick={dismiss}
          className="absolute end-3 top-3 rounded-xl border border-white/10 bg-black/30 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label={tx("pwa.installBanner.dismissAria")}
        >
          <X className="h-4 w-4" />
        </button>

        {showIos ? (
          <div className="relative pe-10">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-primary">
              <Share2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-white">{tx("pwa.installBanner.iosTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{tx("pwa.installBanner.iosBody")}</p>
          </div>
        ) : (
          <div className="relative pe-10">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-primary">
              <Download className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-white">{tx("pwa.installBanner.title")}</h3>
            <p className="mt-1 text-sm text-white/60">{tx("pwa.installBanner.subtitle")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onInstallClick()}
                disabled={installing}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                {installing ? tx("pwa.installBanner.installing") : tx("pwa.installBanner.installCta")}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                {tx("pwa.installBanner.dismiss")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
