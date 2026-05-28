"use client";

import { useEffect, useMemo, useState } from "react";
import { Apple, QrCode, Share2, Smartphone, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type DeviceType = "android" | "ios" | "desktop";
type Audience = "player" | "agent";

type DownloadSectionProps = {
  audience: Audience;
};

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  return "desktop";
}

function StoreButton({
  href,
  download,
  onClick,
  Icon,
  title,
  subtitle,
  glow,
}: {
  href?: string;
  download?: string;
  onClick?: () => void;
  Icon: typeof Smartphone;
  title: string;
  subtitle: string;
  glow: string;
}) {
  const baseClass =
    "group relative inline-flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25";
  const content = (
    <>
      <span className={`pointer-events-none absolute inset-0 rounded-2xl opacity-75 blur-xl ${glow}`} aria-hidden />
      <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="relative text-start">
        <span className="block text-[11px] uppercase tracking-[0.14em] text-white/60">{subtitle}</span>
        <span className="block text-sm font-bold">{title}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} download={download} className={baseClass}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {content}
    </button>
  );
}

export function DownloadSection({ audience }: DownloadSectionProps) {
  const { tx } = useTranslation();
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [origin, setOrigin] = useState("https://gosport365.com");

  useEffect(() => {
    setDevice(detectDevice());
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const heroText = useMemo(() => {
    if (audience === "agent") {
      return {
        title: tx("home.downloadSection.appTitle"),
        subtitle: tx("home.downloadSection.appSubtitle"),
      };
    }
    return {
      title: tx("home.downloadSection.appTitle"),
      subtitle: tx("home.downloadSection.appSubtitle"),
    };
  }, [audience, tx]);

  const qrUrl = useMemo(() => {
    const data = encodeURIComponent(origin);
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${data}`;
  }, [origin]);

  return (
    <section id="download-app" className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0b1220] via-[#101a2c] to-[#1a1326] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-8">
      <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden />

      <div className="relative z-10">
        <div className="mb-5 flex items-center gap-2 text-amber-200">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold tracking-[0.14em]">{tx("home.downloadSection.mobileExperience")}</span>
        </div>

        <h2 className="text-2xl font-black text-white md:text-3xl">{heroText.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">{heroText.subtitle}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {(device === "android" || device === "desktop") && (
              <a
                href="/download/android-app"
                download="gs365cash.apk"
                className="group relative inline-flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle,rgba(16,185,129,0.28),transparent_65%)] opacity-75 blur-xl"
                  aria-hidden
                />
                <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                  <Smartphone className="h-6 w-6" aria-hidden />
                </span>
                <span className="relative text-start">
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-white/60">
                    {tx("home.downloadSection.directApk")}
                  </span>
                  <span className="block text-sm font-bold">
                    {tx("home.downloadSection.downloadAndroid")}
                  </span>
                </span>
              </a>
            )}

            {(device === "ios" || device === "desktop") && (
              <StoreButton
                onClick={() => setShowIosHelp(true)}
                Icon={Apple}
                subtitle={tx("home.downloadSection.pwaInstall")}
                title={tx("home.downloadSection.installIphone")}
                glow="bg-[radial-gradient(circle,rgba(59,130,246,0.28),transparent_65%)]"
              />
            )}
          </div>

          {device === "desktop" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                <QrCode className="h-4 w-4" aria-hidden />
                {tx("home.downloadSection.quickMobileAccess")}
              </div>
              <img
                src={qrUrl}
                alt="QR code for mobile install"
                className="mx-auto h-36 w-36 rounded-xl border border-white/10 bg-white p-1"
                loading="lazy"
              />
              <p className="mt-2 text-xs text-white/60">{tx("home.downloadSection.scanHint")}</p>
            </div>
          )}
        </div>
      </div>

      {showIosHelp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#0d1626] to-[#111827] p-6 shadow-[0_0_70px_rgba(59,130,246,0.25)]">
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="absolute end-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-xl font-black text-white">{tx("home.downloadSection.installIphone")}</h3>
            <p className="mt-2 text-sm text-slate-300">{tx("home.downloadSection.iosInstallSubtitle")}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                  <Share2 className="h-4 w-4" aria-hidden />
                  {tx("home.downloadSection.iosStepOne")}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-100">
                  {tx("home.downloadSection.iosStepTwoPrefix")}{" "}
                  <span className="font-black">{tx("home.downloadSection.iosStepTwoStrong")}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
