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
import { MousePointer2, UserCheck } from "lucide-react";

type CurrentUser = {
  id: string;
  email: string;
  role: string;
  username?: string;
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
  online: boolean;
  rating: number;
  trades_count: number;
  response_minutes: number;
  updated_at?: string;
  country?: string;
};

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
  return `${Math.floor(hours / 24)} d`;
}

export default function PlayerDashboardPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<AgentSummary | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([]);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // 🟢 1. تعريف بيانات الشارت (هادي هي اللي كانت ناقصاك)
  const chartData = useMemo(() => [
    { name: "Mon", value: 400 },
    { name: "Tue", value: 700 },
    { name: "Wed", value: 550 },
    { name: "Thu", value: 900 },
    { name: "Fri", value: 1100 },
    { name: "Sat", value: 1500 },
    { name: "Sun", value: 1300 },
  ], []);

  useEffect(() => {
    const savedUser = localStorage.getItem("mobcash_user");
    if (!savedUser) return void (window.location.href = "/login");
    const parsedUser: CurrentUser = JSON.parse(savedUser);
    if (parsedUser.role !== "player") return void (window.location.href = "/login");
    setUser(parsedUser);

    Promise.all([
      fetch(`/api/notifications?targetRole=player&targetId=${encodeURIComponent(parsedUser.id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/agents/discovery`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/player/orders?email=${encodeURIComponent(parsedUser.email)}`, { cache: "no-store" }).then((res) => res.json()),
    ]).then(([notificationsData, agentsData, ordersData]) => {
      const allAgents: AgentSummary[] = agentsData.agents || [];
      setNotifications(notificationsData.notifications || []);
      setAvailableAgents(allAgents);
      const nextAgent = allAgents.find((item: AgentSummary) => item.agentId === (parsedUser.assigned_agent_id)) || null;
      setAssignedAgent(nextAgent);
      const playerOrders = ordersData.orders || [];
      setLatestOrder(playerOrders.length > 0 ? playerOrders[0] : null);
    }).catch(err => console.error("Error loading dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleDirectSelectAgent = async (agent: AgentSummary) => {
    if (!user?.email) return;
    setSelectingId(agent.agentId);
    try {
      const res = await fetch("/api/player/select-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerEmail: user.email, agentId: agent.agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      const updatedUser: CurrentUser = { ...user, assigned_agent_id: agent.agentId, player_status: "active" };
      localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setAssignedAgent(agent);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSelectingId(null);
    }
  };

  const changeAgent = async () => {
    if (!user?.email) return;
    const res = await fetch("/api/player/change-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: user.email }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) localStorage.setItem("mobcash_user", JSON.stringify(data.user));
      window.location.href = "/player/select-agent";
    }
  };

  if (loading || !user) return <SidebarShell role="player"><LoadingCard text="جاري تحميل بياناتك..." /></SidebarShell>;

  const isInactive = user.player_status !== "active";

  return (
    <SidebarShell role="player">
      <PageHeader
        title={`مرحباً بك، ${user.username || "أيها اللاعب"} 👋`}
        subtitle="إليك ملخص نشاطك الأسبوعي وحالة حسابك مع الوكيل."
        action={<PrimaryButton onClick={changeAgent}>{t("changeAgent")}</PrimaryButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="حالة الحساب" value={isInactive ? "غير نشط" : "نشط"} hint={isInactive ? "يرجى اختيار وكيل للتفعيل." : "جاهز لإرسال الطلبات."} />
        <StatCard label="الوكيل الحالي" value={assignedAgent?.display_name || "لم يتم التحديد"} hint={assignedAgent ? `${assignedAgent.rating}% تقييم إيجابي` : "اربط حسابك بوكيل الآن"} />
        <StatCard label="حالة الوكيل" value={assignedAgent?.online ? "متصل الآن" : "غير متصل"} hint={assignedAgent?.online ? "استجابة فورية" : "قد يتأخر الرد قليلاً"} />
        <StatCard label="آخر شحنة" value={latestOrder ? `${latestOrder.amount} DH` : "0 DH"} hint={latestOrder ? `الحالة: ${latestOrder.status}` : "لم تقم بأي طلب بعد"} />
      </div>

      {isInactive && (
        <GlassCard className="p-6 md:p-8 mt-6 border-cyan-500/20 shadow-xl shadow-cyan-500/5">
          <div className="flex items-center gap-3">
             <UserCheck className="text-cyan-400" size={28} />
             <h2 className="text-2xl font-semibold">اختر وكيلك المفضل</h2>
          </div>
          <p className="mt-2 text-sm text-white/60">اضغط مباشرة على بطاقة الوكيل لربط حسابك به والبدء في الشحن فوراً.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableAgents.map((agent) => (
              <div
                key={agent.agentId}
                onClick={() => !selectingId && handleDirectSelectAgent(agent)}
                className={`relative group cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-5 transition-all duration-300 hover:border-cyan-500/50 hover:bg-white/5 active:scale-[0.98] ${selectingId === agent.agentId ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold group-hover:text-cyan-400">{agent.display_name}</p>
                  <MousePointer2 size={16} className="text-white/20 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-white/40">{agent.rating}% تقييم</span>
                  <span className={agent.online ? "text-emerald-400" : "text-white/20"}>{agent.online ? "● متصل" : "○ غير متصل"}</span>
                </div>
                {selectingId === agent.agentId && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                     <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] mt-6">
        <GlassCard className="p-6 md:p-8">
          {/* 🟢 دابا chartData معرفة وموجودة الفوق */}
          <RevenueAreaChart title="إحصائيات الشحن الأسبوعية" data={chartData} />
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">التنبيهات الأخيرة</h2>
          <div className="mt-5 space-y-3">
            {notifications.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="font-semibold text-sm text-cyan-200">{item.title}</p>
                <p className="mt-1 text-xs text-white/60">{item.message}</p>
              </div>
            ))}
            {!notifications.length && (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">لا توجد تنبيهات حالياً.</div>
            )}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}