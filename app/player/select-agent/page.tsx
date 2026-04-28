"use client";

import { clsx } from "clsx";
import { Clock3, ShieldCheck, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentProfileCard, type AgentProfilePaymentMethod } from "@/components/AgentProfileCard";
import { GlassCard, LoadingCard, PageHeader, SelectField, SidebarShell, StatCard } from "@/components/ui";
import { usePlayerTx } from "@/hooks/usePlayerTx";

type DiscoveryAgent = {
  agentId: string;
  display_name: string;
  username: string;
  email: string;
  online: boolean;
  likes: number;
  dislikes: number;
  payment_pills: string[];
  execution_time_label: string;
  available_balance: number;
  response_minutes: number;
  verified: boolean;
  bank_methods: string[];
  rating_percent: number;
  paymentMethods?: AgentProfilePaymentMethod[];
};

export default function PlayerSelectAgentPage() {
  const tp = usePlayerTx();
  const [user, setUser] = useState<{ email: string; role: string; assignedAgentId?: string } | null>(
    null
  );
  const [agents, setAgents] = useState<DiscoveryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("Morocco");
  const [method, setMethod] = useState("All");
  const [amount, setAmount] = useState("");
  const [time, setTime] = useState("0");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    try {
      const current = JSON.parse(saved) as {
        email?: string;
        role?: string;
        assigned_agent_id?: string | null;
        assignedAgentId?: string | null;
      };
      const role = String(current.role ?? "").trim().toLowerCase();
      if (role !== "player") return void (window.location.href = "/login");

      const assignedId = String(current.assigned_agent_id ?? current.assignedAgentId ?? "").trim();
      if (assignedId) {
        window.location.href = "/player/dashboard";
        return;
      }
      setUser({ email: String(current.email || ""), role: "player" });
    } catch {
      localStorage.removeItem("mobcash_user");
      window.location.href = "/login";
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ country, method, amount, time });
      const res = await fetch(`/api/agents/discovery?${query.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setAgents((data.agents || []) as DiscoveryAgent[]);
    } catch (e) {
      console.error(e);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [country, method, amount, time]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableMethods = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => a.bank_methods?.forEach((m) => m && set.add(m)));
    return ["All", ...Array.from(set)];
  }, [agents]);

  const handleJoin = useCallback(
    async (agentId: string) => {
      const email = user?.email?.trim();
      if (!email) {
        window.location.href = "/login";
        return;
      }
      setJoiningId(agentId);
      try {
        const res = await fetch("/api/player/select-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerEmail: email, agentId }),
        });
        const data = (await res.json()) as { message?: string; user?: unknown };
        if (!res.ok) throw new Error(data.message || tp("selectAgent.joinFailed"));
        const me = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).then((r) => r.json());
        if (me.success && me.user) {
          localStorage.setItem("mobcash_user", JSON.stringify(me.user));
        } else if (data.user) {
          localStorage.setItem("mobcash_user", JSON.stringify(data.user));
        }
        window.location.href = "/player/dashboard";
      } catch (e) {
        alert(e instanceof Error ? e.message : tp("selectAgent.unexpectedError"));
      } finally {
        setJoiningId(null);
      }
    },
    [user?.email, tp]
  );

  if (loading && !user) {
    return (
      <SidebarShell role="player">
        <LoadingCard text={tp("selectAgent.loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader title={tp("selectAgent.pageTitle")} subtitle={tp("selectAgent.pageSubtitle")} />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <StatCard label={tp("selectAgent.statAvailable")} value={String(agents.length)} icon={<ShieldCheck className="text-cyan-400" />} />
        <StatCard
          label={tp("selectAgent.statMethods")}
          value={String(Math.max(0, availableMethods.length - 1))}
          icon={<WalletCards className="text-emerald-400" />}
        />
        <StatCard
          label={tp("selectAgent.statFilter")}
          value={tp("selectAgent.statFilterActive")}
          icon={<Clock3 className="text-amber-400" />}
        />
      </div>

      <GlassCard className="mb-6 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="Morocco">Morocco</option>
          </SelectField>
          <SelectField value={method} onChange={(e) => setMethod(e.target.value)}>
            {availableMethods.map((m) => (
              <option key={m} value={m}>
                {m === "All" ? tp("selectAgent.filterAll") : m}
              </option>
            ))}
          </SelectField>
          <input
            type="number"
            placeholder={tp("selectAgent.placeholderMinAmount")}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            type="number"
            placeholder={tp("selectAgent.placeholderMaxResponse")}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </GlassCard>

      {loading ? (
        <LoadingCard text={tp("selectAgent.searching")} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {agents.length === 0 ? (
            <GlassCard className="p-10 text-center text-white/50 md:col-span-2 xl:col-span-3">
              {tp("selectAgent.empty")}
            </GlassCard>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.agentId}
                className={clsx("relative", joiningId === agent.agentId && "pointer-events-none opacity-60")}
              >
                <AgentProfileCard
                  agent={{
                    id: agent.agentId,
                    name: agent.display_name,
                    username: agent.username,
                    isOnline: agent.online,
                    rating: agent.rating_percent,
                    paymentMethods: agent.paymentMethods,
                  }}
                  headerLabel={tp("selectAgent.availableAgentCard")}
                  actionType="join"
                  onAction={() => void handleJoin(agent.agentId)}
                />
                {joiningId === agent.agentId ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/35 backdrop-blur-[1px]">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </SidebarShell>
  );
}
