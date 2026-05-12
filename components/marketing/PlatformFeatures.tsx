"use client";

import {
  Brain,
  Coins,
  Dice5,
  Globe,
  Headphones,
  Landmark,
  Trophy,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/lib/i18n";

export function PlatformFeatures() {
  const { tx } = useTranslation();
  const FEATURES = useMemo(
    () =>
      [
        {
          id: "arab-leadership",
          Icon: Trophy,
          title: tx("home.platformFeatures.items.arabLeadership.title"),
          description: tx("home.platformFeatures.items.arabLeadership.description"),
          iconTone: "text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]",
        },
        {
          id: "sports-coverage",
          Icon: Globe,
          title: tx("home.platformFeatures.items.sportsCoverage.title"),
          description: tx("home.platformFeatures.items.sportsCoverage.description"),
          iconTone: "text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]",
        },
        {
          id: "huge-winnings",
          Icon: Coins,
          title: tx("home.platformFeatures.items.hugeWinnings.title"),
          description: tx("home.platformFeatures.items.hugeWinnings.description"),
          iconTone: "text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
        },
        {
          id: "high-odds",
          Icon: Zap,
          title: tx("home.platformFeatures.items.highOdds.title"),
          description: tx("home.platformFeatures.items.highOdds.description"),
          iconTone: "text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]",
          badge: tx("home.platformFeatures.items.highOdds.badge"),
        },
        {
          id: "casino",
          Icon: Dice5,
          title: tx("home.platformFeatures.items.casino.title"),
          description: tx("home.platformFeatures.items.casino.description"),
          iconTone: "text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
        },
        {
          id: "fast-pay",
          Icon: Landmark,
          title: tx("home.platformFeatures.items.fastPay.title"),
          description: tx("home.platformFeatures.items.fastPay.description"),
          iconTone: "text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
        },
        {
          id: "strict-finance",
          Icon: Zap,
          title: tx("home.platformFeatures.items.strictFinance.title"),
          description: tx("home.platformFeatures.items.strictFinance.description"),
          iconTone: "text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]",
        },
        {
          id: "ai-system",
          Icon: Brain,
          title: tx("home.platformFeatures.items.aiSystem.title"),
          description: tx("home.platformFeatures.items.aiSystem.description"),
          iconTone: "text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
        },
        {
          id: "support",
          Icon: Headphones,
          title: tx("home.platformFeatures.items.support.title"),
          description: tx("home.platformFeatures.items.support.description"),
          iconTone: "text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]",
        },
      ] as const,
    [tx],
  );
  return (
    <section id="platform-features" className="relative scroll-mt-24 space-y-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.1),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.08),transparent_55%)]"
        aria-hidden
      />

      <div className="relative text-center">
        <h2 className="text-3xl font-black text-white md:text-4xl">
          {tx("home.platformFeatures.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-3xl bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-200 bg-clip-text text-sm font-semibold text-transparent md:text-base">
          {tx("home.platformFeatures.subtitle")}
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, idx) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
          >
            <GlassCard
              className="group h-full border-white/10 bg-white/[0.03] p-6 transition-all hover:border-cyan-300/35 hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] animate-pulse",
                    feature.iconTone,
                  )}
                >
                  <feature.Icon className="h-6 w-6" aria-hidden />
                </div>
                {"badge" in feature && feature.badge ? (
                  <span className="rounded-full border border-amber-300/45 bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                    {feature.badge}
                  </span>
                ) : null}
              </div>
              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{feature.description}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

