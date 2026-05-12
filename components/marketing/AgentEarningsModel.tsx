"use client";

import { Coins, Crown, Percent, Users } from "lucide-react";
import { useMemo } from "react";
import { GlassCard } from "@/components/ui";
import { useTranslation } from "@/lib/i18n";

export function AgentEarningsModel() {
  const { tx } = useTranslation();
  const EARNINGS_ITEMS = useMemo(
    () =>
      [
        {
          id: "direct-margin",
          title: tx("agent.landing.earnings.items.directMargin.title"),
          description: tx("agent.landing.earnings.items.directMargin.description"),
          Icon: Coins,
          tone: "text-amber-300",
        },
        {
          id: "master-agent",
          title: tx("agent.landing.earnings.items.masterAgent.title"),
          description: tx("agent.landing.earnings.items.masterAgent.description"),
          Icon: Crown,
          tone: "text-cyan-300",
        },
        {
          id: "sub-agent-commission",
          title: tx("agent.landing.earnings.items.subAgentCommission.title"),
          description: tx("agent.landing.earnings.items.subAgentCommission.description"),
          Icon: Percent,
          tone: "text-emerald-300",
        },
        {
          id: "player-commission",
          title: tx("agent.landing.earnings.items.playerCommission.title"),
          description: tx("agent.landing.earnings.items.playerCommission.description"),
          Icon: Users,
          tone: "text-emerald-300",
        },
        {
          id: "instant-crediting",
          title: tx("agent.landing.earnings.items.instantSettlement.title"),
          description: tx("agent.landing.earnings.items.instantSettlement.description"),
          Icon: Coins,
          tone: "text-amber-300",
        },
      ] as const,
    [tx],
  );
  return (
    <section className="space-y-6">
      <GlassCard className="border-amber-300/20 bg-gradient-to-br from-amber-500/10 via-white/[0.03] to-transparent p-7 shadow-[0_0_30px_rgba(251,191,36,0.12)] md:p-9">
        <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.earnings.title")}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
          {tx("agent.landing.earnings.subtitle")}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {EARNINGS_ITEMS.map((item) => (
            <div key={item.id} className="rounded-2xl border border-amber-300/20 bg-black/20 p-5 backdrop-blur-md">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <item.Icon className={`h-5 w-5 ${item.tone}`} aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-amber-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

