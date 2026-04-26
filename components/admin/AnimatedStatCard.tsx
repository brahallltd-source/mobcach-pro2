"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  variant?: "cyan" | "violet" | "emerald" | "amber" | "rose";
  delayMs?: number;
  icon?: LucideIcon;
  /** Primary KPI: neon accent on the value (e.g. total liquidity). */
  primaryMetric?: boolean;
};

const GLASS =
  "bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 shadow-lg";

const VARIANT_RING: Record<NonNullable<Props["variant"]>, string> = {
  cyan: "ring-cyan-400/20 from-cyan-500/10 to-transparent",
  violet: "ring-violet-400/15 from-violet-500/10 to-transparent",
  emerald: "ring-emerald-400/20 from-emerald-500/10 to-transparent",
  amber: "ring-amber-400/20 from-amber-500/10 to-transparent",
  rose: "ring-rose-500/25 from-rose-600/10 to-transparent",
};

const VARIANT_ICON: Record<NonNullable<Props["variant"]>, string> = {
  cyan: "text-cyan-300/90",
  violet: "text-violet-300/90",
  emerald: "text-emerald-300/90",
  amber: "text-amber-200/90",
  rose: "text-rose-300/90",
};

export function AnimatedStatCard({
  label,
  value,
  hint,
  variant = "cyan",
  delayMs = 0,
  icon: Icon,
  primaryMetric = false,
}: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  return (
    <div
      className={clsx(
        "rounded-3xl bg-gradient-to-br p-6 ring-1 transition-all duration-700 ease-out",
        GLASS,
        VARIANT_RING[variant],
        on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{label}</p>
          <h3
            className={clsx(
              "mt-2 text-3xl font-extrabold tabular-nums tracking-tight",
              primaryMetric
                ? "text-primary [text-shadow:0_0_24px_hsl(var(--primary)/0.45),0_0_48px_hsl(var(--primary)/0.2)]"
                : "text-white",
            )}
            dir="ltr"
          >
            {value}
          </h3>
          {hint ? <p className="mt-2 text-xs text-white/50">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={clsx(
              "shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 shadow-inner",
              VARIANT_ICON[variant]
            )}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
