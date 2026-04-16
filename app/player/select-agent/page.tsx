"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, Star, WalletCards, Zap } from "lucide-react";
import { useLanguage } from "@/components/language";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";

type CurrentUser = {
  id: string;
  email: string;
  role: string;
  player_status?: "inactive" | "active";
  assigned_agent_id?: string;
};

type FeedbackSummary = {
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
  positiveRate: number;
  presetSamples: string[];
};

type AgentRow = {
  agentId: string;
  display_name: string;
  email: string;
  online: boolean;
  country: string;
  rating: number;
  trades_count: number;
  response_minutes: number;
  min_limit: number;
  max_limit: number;
  available_balance: number;
  verified: boolean;
  featured: boolean;
  trusted?: boolean;
  fast?: boolean;
  success_rate?: number;
  bank_methods: string[];
  supported_assets: string[];
  feedback_summary?: FeedbackSummary;
};

export default function PlayerSelectAgentPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("Morocco");
  const [method, setMethod] = useState("All");
  const [amount, setAmount] = useState("");
  const [time, setTime] = useState("0");
  const [selectingAgentId, setSelectingAgentId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    if (current.assigned_agent_id) return void (window.location.href = "/player/dashboard");
    setUser(current);
  }, []);

  const load = async () => {
    const query = new URLSearchParams({ country, method, amount, time });
    const res = await fetch(`/api/agents/discovery?${query.toString()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setAgents(data.agents || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [country, method, amount, time]);

  const chooseAgent = async (agentId: string) => {
    if (!user?.email) {
      alert("Session expired, please login again");
      window.location.href = "/login";
      return;
    }

    setSelectingAgentId(agentId);

    const res = await fetch("/api/player/select-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: user.email, agentId }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to select agent");
      setSelectingAgentId(null);
      return;
    }

    if (data.user) localStorage.setItem("mobcash_user", JSON.stringify(data.user));
    
    // 🟢 التعديل السحري هنا: توجيه اللاعب مباشرة للداشبورد عوض صفحة الشراء
    window.location.href = "/player/dashboard";
  };

  const availableMethods = useMemo(() => {
    const set = new Set<string>();

    (agents || []).forEach((agent) => {
      (agent?.bank_methods || []).forEach((method: string) => {
        if (method) set.add(method);
      });
    });

    return ["All", ...Array.from(set)];
  }, [agents]);

  const stats = useMemo(
    () => ({
      available: agents.length,
      online: agents.filter((item) => item.online).length,
      verified: agents.filter((item) => item.verified).length,
      fast: agents.filter((item) => item.response_minutes <= 30).length,
    }),
    [agents]
  );

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading agent desk..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="Choose your agent"
        subtitle="Pick the best desk for your preferred payment method, available balance, minimum amount and trust score. No username is required to assign an agent."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Available agents" value={String(stats.available)} hint="Visible in your current filter" />
        <StatCard label="Online now" value={String(stats.online)} hint="Ready to react faster" />
        <StatCard label="Verified" value={String(stats.verified)} hint="Trusted desks with stronger signal" />
        <StatCard label="≤ 30 min" value={String(stats.fast)} hint="Fastest response window" />
      </div>

      <GlassCard className="overflow-hidden p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <TextField value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("countryRegion")} />
          <TextField value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("amount")} type="number" />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
            {availableMethods.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
            {[0, 15, 30, 45, 60, 120, 180].map((value) => (
              <option key={value} value={value}>{value === 0 ? t("all") : `${value} min`}</option>
            ))}
          </select>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {agents.map((agent) => {
          const feedback = agent.feedback_summary;
          return (
            <GlassCard key={agent.agentId} className="overflow-hidden p-5 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
                        {agent.display_name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-2xl font-semibold">{agent.display_name}</h3>
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${agent.online ? "bg-emerald-400" : "bg-white/20"}`} />
                          {agent.verified ? (
                            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">verified</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-white/50">{agent.country} • {agent.online ? t("online") : t("offline")}</p>
                      </div>
                    </div>
                    {agent.featured ? (
                      <div className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-100">Featured</div>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/55"><Star size={14} className="text-amber-300" /> Rating</div><p className="mt-2 text-xl font-semibold">{agent.rating}%</p></div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/55"><WalletCards size={14} className="text-cyan-300" /> Trades</div><p className="mt-2 text-xl font-semibold">{agent.trades_count}</p></div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/55"><Clock3 size={14} className="text-cyan-300" /> ETA</div><p className="mt-2 text-xl font-semibold">{agent.response_minutes} min</p></div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/55"><Zap size={14} className="text-emerald-300" /> Success rate</div><p className="mt-2 text-xl font-semibold">{agent.success_rate || 0}%</p></div>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Available now</p>
                      <p className="mt-2 text-xl font-semibold">{agent.available_balance} DH</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Minimum</p>
                      <p className="mt-2 text-xl font-semibold">{agent.min_limit} DH</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Methods</p>
                      <p className="mt-2 text-sm text-white/75">{agent.bank_methods.join(" • ") || "No methods yet"}</p>
                    </div>
                  </div>

                  {feedback ? (
                    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                          <CheckCircle2 size={14} /> {feedback.positiveRate}% positive
                        </div>
                        <p className="text-sm text-white/55">{feedback.positiveCount} likes • {feedback.negativeCount} dislikes • {feedback.totalCount} ratings</p>
                      </div>
                      {feedback.presetSamples?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {feedback.presetSamples.map((sample) => (
                            <span key={sample} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{sample}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      <ShieldCheck size={14} /> Ready to assign
                    </div>
                    <h4 className="mt-4 text-xl font-semibold">Assign this agent</h4>
                    <p className="mt-2 text-sm leading-6 text-white/60">This will link the player to the selected agent so the next recharge can start directly with the right payment instructions.</p>
                  </div>
                  <PrimaryButton onClick={() => chooseAgent(agent.agentId)} disabled={selectingAgentId === agent.agentId || agent.available_balance <= 0}>
                    {selectingAgentId === agent.agentId ? "Assigning..." : agent.available_balance <= 0 ? "Awaiting recharge" : "Choose this agent"}
                  </PrimaryButton>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </SidebarShell>
  );
}