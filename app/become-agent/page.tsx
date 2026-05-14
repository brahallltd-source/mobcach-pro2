"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BadgeCheck,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Headset,
  LayoutDashboard,
  Landmark,
  Lock,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { GlassCard, Shell } from "@/components/ui";
import { AgentEarningsModel } from "@/components/marketing/AgentEarningsModel";
import { AgentFAQSection } from "@/components/marketing/AgentFAQSection";
import { AgentLiveStats } from "@/components/marketing/AgentLiveStats";
import { Footer } from "@/components/Footer";
import { PlatformFeatures } from "@/components/marketing/PlatformFeatures";
import { DownloadSection } from "@/components/marketing/DownloadSection";
import { useTranslation } from "@/lib/i18n";

export default function BecomeAgentPage() {
  const { tx } = useTranslation();
  const AGENT_FLOW_STEPS = useMemo(
    () =>
      [
        { id: "create-account", Icon: UserPlus, title: tx("agent.landing.flow.steps.0.title"), desc: tx("agent.landing.flow.steps.0.description") },
        { id: "admin-approval", Icon: ShieldCheck, title: tx("agent.landing.flow.steps.1.title"), desc: tx("agent.landing.flow.steps.1.description") },
        { id: "activate-interfaces", Icon: MessageSquare, title: tx("agent.landing.flow.steps.2.title"), desc: tx("agent.landing.flow.steps.2.description") },
        { id: "banking-details", Icon: Landmark, title: tx("agent.landing.flow.steps.3.title"), desc: tx("agent.landing.flow.steps.3.description") },
        { id: "wallet-topup", Icon: Wallet, title: tx("agent.landing.flow.steps.4.title"), desc: tx("agent.landing.flow.steps.4.description") },
        { id: "register-players", Icon: Users, title: tx("agent.landing.flow.steps.5.title"), desc: tx("agent.landing.flow.steps.5.description") },
        { id: "send-credentials", Icon: Send, title: tx("agent.landing.flow.steps.6.title"), desc: tx("agent.landing.flow.steps.6.description") },
      ] as const,
    [tx],
  );
  const AGENT_DEPOSIT_FLOW_STEPS = useMemo(
    () =>
      [
        { id: "payment-request", Icon: BellRing, title: tx("agent.landing.depositFlow.steps.0.title"), desc: tx("agent.landing.depositFlow.steps.0.description") },
        { id: "ai-validation", Icon: BrainCircuit, title: tx("agent.landing.depositFlow.steps.1.title"), desc: tx("agent.landing.depositFlow.steps.1.description") },
        { id: "approval", Icon: UserCheck, title: tx("agent.landing.depositFlow.steps.2.title"), desc: tx("agent.landing.depositFlow.steps.2.description") },
        { id: "balance-transfer", Icon: BadgeCheck, title: tx("agent.landing.depositFlow.steps.3.title"), desc: tx("agent.landing.depositFlow.steps.3.description") },
      ] as const,
    [tx],
  );
  const AGENT_BENEFITS = useMemo(
    () =>
      [
        { id: "dashboard", Icon: LayoutDashboard, title: tx("agent.landing.benefits.items.dashboard.title"), desc: tx("agent.landing.benefits.items.dashboard.description") },
        { id: "direct-profit", Icon: CircleDollarSign, title: tx("agent.landing.benefits.items.directProfit.title"), desc: tx("agent.landing.benefits.items.directProfit.description") },
        { id: "support", Icon: Headset, title: tx("agent.landing.benefits.items.support.title"), desc: tx("agent.landing.benefits.items.support.description") },
      ] as const,
    [tx],
  );
  const DASHBOARD_FEATURES = useMemo(
    () =>
      [
        { id: "players-management", title: tx("agent.landing.dashboardFeatures.items.playersManagement.title"), desc: tx("agent.landing.dashboardFeatures.items.playersManagement.description") },
        { id: "embedded-chat", title: tx("agent.landing.dashboardFeatures.items.embeddedChat.title"), desc: tx("agent.landing.dashboardFeatures.items.embeddedChat.description") },
        { id: "instant-withdrawals", title: tx("agent.landing.dashboardFeatures.items.instantWithdrawals.title"), desc: tx("agent.landing.dashboardFeatures.items.instantWithdrawals.description") },
        { id: "realtime-notifications", title: tx("agent.landing.dashboardFeatures.items.realtimeNotifications.title"), desc: tx("agent.landing.dashboardFeatures.items.realtimeNotifications.description") },
      ] as const,
    [tx],
  );
  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-14 pb-20 md:space-y-20 md:pb-28">
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-white/[0.03] p-6 shadow-glass backdrop-blur-2xl md:p-10 lg:p-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.12),transparent_55%)]"
            aria-hidden
          />
          <div className="relative z-10 max-w-3xl">
            <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl">
              {tx("agent.landing.hero.title")}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-300 md:text-lg">
              {tx("agent.landing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register/agent"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:brightness-110"
              >
                {tx("agent.landing.hero.ctaRegister")}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white shadow-none backdrop-blur-sm transition hover:bg-white/10"
              >
                {tx("agent.landing.hero.ctaLogin")}
              </Link>
            </div>
          </div>
        </section>

        <AgentLiveStats />

        <PlatformFeatures />

        <section>
          <GlassCard className="border-emerald-300/25 bg-gradient-to-r from-emerald-500/12 via-cyan-500/8 to-emerald-500/12 p-6 shadow-[0_0_28px_rgba(16,185,129,0.2)] md:p-7">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-500/20 text-sm font-black text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                aria-hidden
              >
                {tx("agent.landing.usdtNotice.badge")}
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">{tx("agent.landing.usdtNotice.title")}</h3>
                <p className="mt-2 text-sm leading-7 text-emerald-100/90">
                  {tx("agent.landing.usdtNotice.prefix")} <strong>{tx("agent.landing.usdtNotice.minAmount")}</strong>.{" "}
                  {tx("agent.landing.usdtNotice.middle")} <strong>{tx("agent.landing.usdtNotice.network")}</strong>{" "}
                  {tx("agent.landing.usdtNotice.suffix")}
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.flow.title")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
              {tx("agent.landing.flow.subtitle")}
            </p>
          </div>
          <div className="relative space-y-4">
            <div className="pointer-events-none absolute bottom-0 right-7 top-2 hidden w-px bg-gradient-to-b from-cyan-300/40 via-emerald-300/30 to-transparent md:block lg:right-1/2" />
            {AGENT_FLOW_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`relative md:pe-16 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-8 lg:pe-0 ${
                  index % 2 === 0 ? "" : "lg:[&>*:first-child]:col-start-2"
                }`}
              >
                <span className="absolute right-6 top-7 z-10 hidden h-3 w-3 rounded-full border border-cyan-200/40 bg-cyan-300/80 shadow-[0_0_14px_rgba(34,211,238,0.75)] md:block lg:right-1/2 lg:translate-x-1/2" />
                <GlassCard className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.22)]">
                    <step.Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
                    {tx("agent.landing.flow.stepLabel", { number: String(index + 1) })}
                  </p>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{step.desc}</p>
                </GlassCard>
              </div>
            ))}
          </div>
          <GlassCard className="border-emerald-300/25 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 p-4 shadow-[0_0_26px_rgba(16,185,129,0.2)] md:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100 md:text-base">
              <Lock className="h-4 w-4 animate-pulse text-emerald-300" aria-hidden />
              {tx("agent.landing.flow.securityBanner")}
            </p>
          </GlassCard>
        </section>

        <AgentEarningsModel />

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.depositFlow.title")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
              {tx("agent.landing.depositFlow.subtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {AGENT_DEPOSIT_FLOW_STEPS.map((step, index) => (
              <GlassCard key={step.id} className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.22)]">
                  <step.Icon className="h-6 w-6" aria-hidden />
                </div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
                  {tx("agent.landing.flow.stepLabel", { number: String(index + 1) })}
                </p>
                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{step.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <GlassCard className="p-7 md:p-9">
            <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.dashboardFeatures.title")}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {DASHBOARD_FEATURES.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                    <div>
                      <h3 className="text-base font-bold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-7 text-slate-300">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.benefits.title")}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {AGENT_BENEFITS.map((benefit) => (
              <GlassCard key={benefit.id} className="p-8">
                <benefit.Icon className="mb-4 h-10 w-10 text-emerald-300" aria-hidden />
                <h3 className="text-xl font-bold text-white">{benefit.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{benefit.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <DownloadSection audience="agent" />

        <AgentFAQSection />

        <Footer />
      </div>
    </Shell>
  );
}
