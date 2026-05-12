"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";

const BASE_DAILY = 1245;
const BASE_WEEKLY = 8730;
const BASE_MONTHLY = 34200;

function formatStat(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SimulatedStats() {
  const { tx } = useTranslation();
  const [daily, setDaily] = useState(BASE_DAILY);

  useEffect(() => {
    const intervalMs = 8000 + Math.floor(Math.random() * 7001); // 8s..15s
    const timer = window.setInterval(() => {
      const step = Math.random() < 0.5 ? 1 : 2;
      setDaily((prev) => prev + step);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, []);

  const cards = useMemo(
    () => [
      {
        key: "today",
        label: tx("home.liveStats.today"),
        value: daily,
        live: true,
      },
      {
        key: "week",
        label: tx("home.liveStats.week"),
        value: BASE_WEEKLY,
        live: false,
      },
      {
        key: "month",
        label: tx("home.liveStats.month"),
        value: BASE_MONTHLY,
        live: false,
      },
    ],
    [daily, tx],
  );

  return (
    <section className="mb-12 mt-12 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label={tx("home.liveStats.ariaLabel")}>
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-8"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400 md:text-base">
            {card.live ? <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> : null}
            <span>{card.label}</span>
            {card.live ? <span className="text-[11px] uppercase tracking-wide text-emerald-300/90">{tx("home.liveStats.live")}</span> : null}
          </div>
          <p className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-[0_0_12px_rgba(52,211,153,0.4)] md:text-5xl">
            {formatStat(card.value)}
          </p>
        </div>
      ))}
    </section>
  );
}

