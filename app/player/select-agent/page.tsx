"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, ShieldCheck, Star, WalletCards, Zap } from "lucide-react";
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
  last_activity?: string;
  bank_methods: string[];
  supported_assets: string[];
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

    if (!agentId) {
      alert("Please choose a valid agent");
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
    alert(data.message || "Agent selected successfully");
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
        title={t("selectAgent")}
        subtitle="Compare agents like a pro desk: speed, trust score, supported banks, live availability and realistic payment limits optimized for mobile first selection."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Available agents" value={String(stats.available)} hint="Visible in your current filter" />
        <StatCard label="Online now" value={String(stats.online)} hint="Ready to react faster" />
        <StatCard label="Verified" value={String(stats.verified)} hint="Trusted desks with stronger signal" />
        <StatCard label="≤ 30 min" value={String(stats.fast)} hint="Fastest response window" />
      </div>

      <GlassCard className="overflow-hidden p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <TextField
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("countryRegion")}
          />
          <TextField
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("amount")}
            type="number"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
          >
            {availableMethods.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
          >
            {[0, 15, 30, 45, 60, 120, 180].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? t("all") : `${value} min`}
              </option>
            ))}
          </select>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {agents.map((agent) => (
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
                        {agent.online ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/20" />
                        )}
                        {agent.verified ? (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                            verified
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white/50">
                        {agent.country} • {agent.online ? t("online") : t("offline")}
                      </p>
                    </div>
                  </div>
                  {agent.featured ? (
                    <div className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-100">
                      Featured
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-white/55">
                      <Star size={14} className="text-amber-300" /> Rating
                    </div>
                    <p className="mt-2 text-xl font-semibold">{agent.rating}%</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-white/55">
                      <WalletCards size={14} className="text-cyan-300" /> Trades
                    </div>
                    <p className="mt-2 text-xl font-semibold">{agent.trades_count}</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-white/55">
                      <Clock3 size={14} className="text-cyan-300" /> ETA
                    </div>
                    <p className="mt-2 text-xl font-semibold">{agent.response_minutes} min</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-white/55">
                      <Zap size={14} className="text-emerald-300" /> Success rate
                    </div>
                    <p className="mt-2 text-xl font-semibold">{agent.success_rate || 0}%</p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-white/55">
                    <WalletCards size={16} /> Supported methods
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(agent?.bank_methods || []).map((method: string) => (
                      <span key={method} className="px-2 py-1 bg-gray-700 rounded text-xs">
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/45">{t("limit")}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {Number(agent?.min_limit || 0).toLocaleString()} -{" "}
                  {Number(agent?.max_limit || 0).toLocaleString()} MAD
                </p>
                <p className="mt-3 text-sm text-white/60">
                  {t("available")}: {Number(agent?.available_balance || 0).toLocaleString()} MAD
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Assets: {(agent?.supported_assets || []).join(" • ")}
                </p>
                <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-white/65">
                  This agent desk is tuned for direct recharge flow with clearer proof review and stronger mobile purchase experience.
                </div>
                <PrimaryButton
                  onClick={() => chooseAgent(agent.agentId)}
                  disabled={selectingAgentId === agent.agentId}
                  className="mt-6 w-full"
                >
                  {selectingAgentId === agent.agentId ? "Linking..." : t("chooseAgent")}
                </PrimaryButton>
              </div>
            </div>
          </GlassCard>
        ))}

        {!agents.length ? (
          <GlassCard className="p-10 text-center text-white/60">{t("noOffers")}</GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}