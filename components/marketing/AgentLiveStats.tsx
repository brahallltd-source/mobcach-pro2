"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const BASE_DAILY = 15420;
const BASE_WEEKLY = 108950;
const BASE_MONTHLY = 465000;

function formatDh(value: number): string {
  return `${new Intl.NumberFormat("en-US").format(value)} DH`;
}

export function AgentLiveStats() {
  const { tx } = useTranslation();
  const [daily, setDaily] = useState(BASE_DAILY);
  const [actionIndex, setActionIndex] = useState(0);
  const recentActions = useMemo(
    () => [
      tx("agent.landing.liveStats.actions.0"),
      tx("agent.landing.liveStats.actions.1"),
      tx("agent.landing.liveStats.actions.2"),
    ],
    [tx],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const delta = 100 + Math.floor(Math.random() * 201); // 100..300
      setDaily((prev) => prev + delta);
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActionIndex((prev) => (prev + 1) % recentActions.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [recentActions.length]);

  const stats = useMemo(
    () => [
      { id: "daily", label: tx("agent.landing.liveStats.daily"), value: daily },
      { id: "weekly", label: tx("agent.landing.liveStats.weekly"), value: BASE_WEEKLY },
      { id: "monthly", label: tx("agent.landing.liveStats.monthly"), value: BASE_MONTHLY },
    ],
    [daily, tx],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 animate-pulse text-emerald-300" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
            {tx("agent.landing.liveStats.liveTracking")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">{s.label}</p>
              <p className="mt-2 bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-200 bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_0_10px_rgba(16,185,129,0.35)] md:text-4xl">
                {formatDh(s.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
        {recentActions[actionIndex]}
      </div>
    </section>
  );
}

