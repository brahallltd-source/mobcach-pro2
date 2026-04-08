"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Globe2, ShieldCheck, TimerReset, WalletCards } from "lucide-react";
import { GlassCard, PrimaryButton, Shell } from "@/components/ui";

type Banner = { title: string; subtitle: string; image: string; link: string; active: boolean };
type Branding = {
  brandName: string;
  logoUrl: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  heroImages: string[];
  banners: Banner[];
};

const defaultBranding: Branding = {
  brandName: "MobCash Pro",
  logoUrl: "",
  heroTitle: "Recharge made simple, trusted and mobile-first.",
  heroBody:
    "MobCash Pro connects players, agents and admins with a clean recharge flow, clear agent selection and proof-based order confirmation.",
  primaryCta: "Start Recharge",
  secondaryCta: "Become an Agent",
  heroImages: ["/hero/hero-1.svg", "/hero/hero-2.svg"],
  banners: [
    {
      title: "Fast recharge flow",
      subtitle: "Choose your agent and upload your proof in a clear guided flow.",
      image: "/hero/hero-1.svg",
      link: "/register/player",
      active: true,
    },
    {
      title: "Join as an agent",
      subtitle: "Operate your wallet, payment methods and orders from one workspace.",
      image: "/hero/hero-2.svg",
      link: "/apply/agent",
      active: true,
    },
  ],
};

const trustCards = [
  { value: "24/7", label: "Multi-language support" },
  { value: "3", label: "Player • Agent • Admin workspaces" },
  { value: "100%", label: "Review-first proof flow" },
];

const flow = [
  {
    step: "01",
    title: "Create your player account",
    text: "Enter your details and optionally add an agent code. If you do not have one, you can choose the right agent after registration.",
  },
  {
    step: "02",
    title: "Choose the right agent",
    text: "Compare response time, supported methods, rating and availability before assigning an agent to your account.",
  },
  {
    step: "03",
    title: "Send payment and upload proof",
    text: "Review transfer instructions, upload your proof and let the assigned agent complete the recharge flow.",
  },
];

const featureCards = [
  {
    icon: WalletCards,
    title: "Clear wallet operations",
    text: "Admin top-ups, agent earnings, bonus logic and transaction logs stay connected to one clear operational backbone.",
  },
  {
    icon: ShieldCheck,
    title: "Secure order lifecycle",
    text: "Every order passes through instructions, proof upload, agent review, confirmation and fraud review when needed.",
  },
  {
    icon: Globe2,
    title: "Supported methods",
    text: "Support bank transfer, CIH, Attijariwafa, BMCE, Cash Plus, Wafacash and optional crypto methods such as USDT and BTC.",
  },
  {
    icon: TimerReset,
    title: "Visible response time",
    text: "Execution time is visible directly on agent offers so players can pick faster operators.",
  },
];

export default function HomePage() {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch("/api/admin/branding", { cache: "no-store" });
        const data = await res.json();
        setBranding({ ...defaultBranding, ...(data.branding || {}) });
      } catch {
        setBranding(defaultBranding);
      }
    };

    void loadBranding();
  }, []);

  const activeBanners = useMemo(
    () => (branding.banners || []).filter((item) => item.active),
    [branding.banners]
  );

  useEffect(() => {
    if (!activeBanners.length) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  const currentBanner = activeBanners[bannerIndex] || null;

  return (
    <Shell>

  
      <div className="mx-auto max-w-7xl space-y-8">
        <GlassCard className="overflow-hidden px-5 py-7 md:px-8 md:py-9 xl:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl xl:text-6xl">
                {branding.heroTitle}
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-white/65 md:text-base">
                {branding.heroBody}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/register/player">
                  <PrimaryButton className="min-w-[180px] px-6 py-3 text-sm font-semibold">
                    {branding.primaryCta || "Start Recharge"}
                  </PrimaryButton>
                </Link>

                <Link
                  href="/apply/agent"
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {branding.secondaryCta || "Become an Agent"}
                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/login"
                  className="inline-flex min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  Login
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {trustCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-white/10 bg-black/20 p-4 md:p-5"
                  >
                    <p className="text-2xl font-semibold md:text-3xl">{item.value}</p>
                    <p className="mt-2 text-xs leading-5 text-white/55 md:text-sm">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {currentBanner ? (
                <Link href={currentBanner.link} className="block">
                  <GlassCard className="overflow-hidden p-4 transition hover:bg-white/[0.08]">
                    <div className="grid gap-5 md:grid-cols-[0.56fr_0.44fr] md:items-center">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                          Live banner
                        </p>
                        <h2 className="mt-3 text-xl font-semibold md:text-2xl">
                          {currentBanner.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          {currentBanner.subtitle}
                        </p>
                      </div>

                      <img
                        src={currentBanner.image || branding.heroImages[0] || "/hero/hero-1.svg"}
                        alt="current banner"
                        className="h-52 w-full rounded-[24px] object-cover"
                      />
                    </div>
                  </GlassCard>
                </Link>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {(branding.heroImages || []).slice(0, 2).map((image, index) => (
                  <GlassCard key={index} className="overflow-hidden p-2.5">
                    <img
                      src={image || "/hero/hero-1.svg"}
                      alt={`hero-${index + 1}`}
                      className="h-44 w-full rounded-[20px] object-cover"
                    />
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-3">
          {flow.map((item) => (
            <GlassCard key={item.step} className="p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                {item.step}
              </p>
              <h3 className="mt-3 text-xl font-semibold md:text-2xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.text}</p>
            </GlassCard>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((item) => (
            <GlassCard key={item.title} className="p-5 md:p-6">
              <div className="inline-flex rounded-2xl bg-cyan-400/10 p-3 text-cyan-200">
                <item.icon size={18} />
              </div>
              <h3 className="mt-4 text-lg font-semibold md:text-xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.text}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </Shell>
  );
}