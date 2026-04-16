"use client";

import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
} from "@/components/ui";
import { useLanguage } from "@/components/language";

type CurrentUser = {
  id: string;
  email: string;
  role: string;
  player_status?: "inactive" | "active";
  assigned_agent_id?: string;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

type AgentSummary = {
  agentId: string;
  display_name: string;
  username?: string;
  email?: string;
  online: boolean;
  rating: number;
  trades_count: number;
  response_minutes: number;
  updated_at?: string;
  country?: string;
};

// 🟢 عوضنا Winner بـ Order
type Order = {
  id: string;
  amount: number;
  status: string;
};

function formatAwayTime(value?: string) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";

  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export default function PlayerDashboardPage() {
  const { t } = useLanguage();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<AgentSummary | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([]);
  
  // 🟢 حالة جديدة لتخزين آخر طلب
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("mobcash_user");

    if (!savedUser) {
      window.location.href = "/login";
      return;
    }

    const parsedUser: CurrentUser = JSON.parse(savedUser);

    if (parsedUser.role !== "player") {
      window.location.href = "/login";
      return;
    }

    setUser(parsedUser);

    Promise.all([
      fetch(
        `/api/notifications?targetRole=player&targetId=${encodeURIComponent(
          parsedUser.id
        )}`,
        { cache: "no-store" }
      ).then((res) => res.json()),
      fetch(`/api/agents/discovery`, { cache: "no-store" }).then((res) =>
        res.json()
      ),
      // 🟢 جبنا الطلبات ديال اللاعب بلاصة السحوبات
      fetch(
        `/api/player/orders?email=${encodeURIComponent(parsedUser.email)}`,
        { cache: "no-store" }
      ).then((res) => res.json()),
    ])
      .then(([notificationsData, agentsData, ordersData]) => {
        const allAgents: AgentSummary[] = agentsData.agents || [];
        setNotifications(notificationsData.notifications || []);
        setAvailableAgents(allAgents);

        const nextAgent =
          allAgents.find(
            (item: AgentSummary) =>
              item.agentId === parsedUser.assigned_agent_id
          ) || null;

        setAssignedAgent(nextAgent);

        // 🟢 كناخدو غير الطلب الأول (أحدث واحد)
        const playerOrders = ordersData.orders || [];
        setLatestOrder(playerOrders.length > 0 ? playerOrders[0] : null);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(
    () => [
      { name: "Mon", value: 500 },
      { name: "Tue", value: 800 },
      { name: "Wed", value: 650 },
      { name: "Thu", value: 1200 },
      { name: "Fri", value: 980 },
      { name: "Sat", value: 1600 },
      { name: "Sun", value: 1900 },
    ],
    []
  );

  const changeAgent = async () => {
    if (!user?.email) return;

    const res = await fetch("/api/player/change-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: user.email }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Unable to change agent");
      return;
    }

    if (data.user) {
      localStorage.setItem("mobcash_user", JSON.stringify(data.user));
    }

    window.location.href = "/player/select-agent";
  };

  if (loading || !user) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading player dashboard..." />
      </SidebarShell>
    );
  }

  const isInactive = user.player_status !== "active";

  return (
    <SidebarShell role="player">
      <PageHeader
        title="Player workspace"
        subtitle="Simple actions, direct recharge flow and a clearer experience with your assigned agent."
        action={<PrimaryButton onClick={changeAgent}>{t("changeAgent")}</PrimaryButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Account state"
          value={isInactive ? t("statusInactive") : t("statusActive")}
          hint={
            isInactive
              ? "Your account is inactive until you choose or link an agent."
              : "Ready for recharge and proof upload"
          }
        />

        <StatCard
          label={t("assignedAgent")}
          value={
            assignedAgent?.display_name ||
            user.assigned_agent_id ||
            t("noAgentYet")
          }
          hint={
            assignedAgent
              ? `${assignedAgent.rating}% • ${assignedAgent.trades_count} ${t(
                  "trades"
                )}`
              : "Select an agent to start"
          }
        />

        <StatCard
          label={t("agentStatus")}
          value={assignedAgent?.online ? t("online") : t("offline")}
          hint={
            assignedAgent?.online
              ? `${assignedAgent.response_minutes} min ETA`
              : `${t("awayFor")} ${formatAwayTime(assignedAgent?.updated_at)}`
          }
        />

        {/* 🟢 ها هي الخانة ديال آخر طلب تريكْلات */}
        <StatCard
          label="Latest order"
          value={latestOrder ? `${latestOrder.amount} DH` : "No orders yet"}
          hint={latestOrder ? `Status: ${latestOrder.status.replace(/_/g, ' ')}` : "Create a new recharge request"}
        />
      </div>

      {isInactive ? (
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Choose your agent</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Your account is inactive. To activate your player workflow, choose
            one of the available agents below.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableAgents.length ? (
              availableAgents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <p className="text-lg font-semibold">{agent.display_name}</p>

                  <p className="mt-2 text-sm text-white/60">
                    {agent.country || "—"}
                  </p>

                  <p className="mt-2 text-sm text-white/60">
                    {agent.rating}% • {agent.trades_count} trades
                  </p>

                  <p className="mt-2 text-sm text-white/60">
                    Response: {agent.response_minutes} min
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    Status: {agent.online ? "Online" : "Offline"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55 md:col-span-2 xl:col-span-3">
                No agents available right now.
              </div>
            )}
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 md:p-8">
          <RevenueAreaChart title="Weekly activity" data={chartData} />
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Latest notifications</h2>

          <div className="mt-5 space-y-3">
            {notifications.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-white/60">{item.message}</p>
              </div>
            ))}

            {!notifications.length ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">
                No notifications yet.
              </div>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}