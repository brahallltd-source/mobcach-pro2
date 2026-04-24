"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RevenueAreaChart } from "@/components/charts";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
} from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import { fetchSessionUser, redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { AlertTriangle, MousePointer2, UserCheck } from "lucide-react";
import { AgentProfileCard, type AgentProfileCardAgent } from "@/components/AgentProfileCard";

type CurrentUser = {
  id: string;
  email: string;
  role: string;
  username?: string;
  /** `User.status` — PENDING_APPROVAL waits on agent; PENDING_AGENT completes linking on `/player/choose-agent`. */
  status?: string;
  player_status?: "inactive" | "active";
  assigned_agent_id?: string;
  /** `User.playerStatus` — e.g. `rejected` after agent declines link request. */
  playerLinkStatus?: string | null;
  rejectionReason?: string | null;
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
  paymentMethods?: AgentProfileCardAgent["paymentMethods"];
};

type Order = {
  id: string;
  amount: number;
  status: string;
};

type MyAgentApiAgent = {
  id: string;
  name: string;
  username: string;
  email?: string;
  isOnline: boolean;
};

type MyAgentApiPaymentMethod = {
  id: string;
  methodName: string;
  methodTitle?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: string;
  currency?: string;
};

type MyAgentBundle = {
  agent: MyAgentApiAgent | null;
  paymentMethods: MyAgentApiPaymentMethod[];
  chatHref: string;
};

export default function PlayerDashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<AgentSummary | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([]);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [myAgentBundle, setMyAgentBundle] = useState<MyAgentBundle | null>(null);
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
    void (async () => {
      const parsed = await requireMobcashUserOnClient("player");
      if (!parsed) {
        redirectToLogin();
        return;
      }
      const fromServer = (await fetchSessionUser()) as MobcashUser | null;
      const mu = (fromServer ?? parsed) as MobcashUser;
      if (fromServer) {
        localStorage.setItem("mobcash_user", JSON.stringify(fromServer));
      }
      const assignedId = mu.player?.assignedAgentId ?? undefined;
      const parsedUser: CurrentUser = {
        id: mu.id,
        email: mu.email,
        role: mu.role,
        username: mu.player?.username ?? "",
        status: mu.status,
        player_status: mu.player?.status === "active" ? "active" : "inactive",
        assigned_agent_id: assignedId,
      };
      setUser(parsedUser);

      const acct = String(parsedUser.status ?? "").trim().toUpperCase();
      if (acct === "PENDING_AGENT") {
        router.replace("/player/choose-agent");
        return;
      }

      if (acct === "PENDING_APPROVAL") {
        try {
          const agentsData = await (
            await fetch("/api/agents/discovery", { cache: "no-store" })
          ).json();
          const allAgents: AgentSummary[] = agentsData.agents || [];
          setAssignedAgent(
            allAgents.find((item: AgentSummary) => item.agentId === assignedId) || null
          );
        } catch (e) {
          console.error("Error loading agent for pending approval:", e);
        } finally {
          setLoading(false);
        }
        return;
      }

      Promise.all([
        fetch("/api/agents/discovery", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/player/orders", {
          cache: "no-store",
          credentials: "include",
        }).then((res) => res.json()),
        fetch("/api/player/my-agent", { cache: "no-store", credentials: "include" }).then((res) => res.json()),
      ])
        .then(([agentsData, ordersData, myAgentJson]) => {
          const allAgents: AgentSummary[] = agentsData.agents || [];
          setAvailableAgents(allAgents);
          const nextAgent =
            allAgents.find((item: AgentSummary) => item.agentId === assignedId) || null;
          setAssignedAgent(nextAgent);
          const playerOrders = ordersData.orders || [];
          setLatestOrder(playerOrders.length > 0 ? playerOrders[0] : null);
          const raw = myAgentJson as Record<string, unknown>;
          setMyAgentBundle({
            agent: (raw.agent as MyAgentApiAgent | null | undefined) ?? null,
            paymentMethods: Array.isArray(raw.paymentMethods)
              ? (raw.paymentMethods as MyAgentApiPaymentMethod[])
              : [],
            chatHref: typeof raw.chatHref === "string" && raw.chatHref ? raw.chatHref : "/player/chat",
          });
        })
        .catch((err) => {
          console.error("Error loading dashboard:", err);
          setMyAgentBundle({ agent: null, paymentMethods: [], chatHref: "/player/chat" });
        })
        .finally(() => setLoading(false));
    })();
  }, [router]);

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

      const updatedUser: CurrentUser = {
        ...user,
        assigned_agent_id: agent.agentId,
        player_status: "active",
        status: (data.user as { status?: string })?.status ?? "ACTIVE",
      };
      localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setAssignedAgent(agent);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "تعذّر اختيار الوكيل");
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

  const agentProfileData: AgentProfileCardAgent | null = useMemo(() => {
    if (myAgentBundle?.agent) {
      return {
        id: myAgentBundle.agent.id,
        name: myAgentBundle.agent.name,
        username: myAgentBundle.agent.username,
        isOnline: myAgentBundle.agent.isOnline,
        paymentMethods: myAgentBundle.paymentMethods,
        chatHref: myAgentBundle.chatHref,
        rating: assignedAgent?.rating,
      };
    }
    if (assignedAgent) {
      const fromDiscovery = availableAgents.find((a) => a.agentId === assignedAgent.agentId);
      return {
        id: assignedAgent.agentId,
        name: assignedAgent.display_name,
        username: assignedAgent.username,
        isOnline: assignedAgent.online,
        paymentMethods: fromDiscovery?.paymentMethods ?? [],
        chatHref: `/player/chat?agentId=${encodeURIComponent(assignedAgent.agentId)}`,
        rating: assignedAgent.rating,
      };
    }
    return null;
  }, [myAgentBundle, assignedAgent, availableAgents]);

  if (loading || !user) return <SidebarShell role="player"><LoadingCard text="جاري تحميل بياناتك..." /></SidebarShell>;

  const acctUpper = String(user.status ?? "").trim().toUpperCase();
  const psLower = String(user.playerLinkStatus ?? "").trim().toLowerCase();
  const rej = String(user.rejectionReason ?? "").trim();
  const showAgentRejectionCard =
    psLower === "rejected" || (acctUpper === "PENDING_AGENT" && Boolean(rej) && !user.assigned_agent_id);

  if (showAgentRejectionCard) {
    return (
      <SidebarShell role="player">
        <GlassCard className="mx-auto mt-10 max-w-xl border-amber-500/35 bg-amber-500/10 p-8 shadow-xl backdrop-blur-md md:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 ring-2 ring-amber-400/40">
              <AlertTriangle className="h-9 w-9 text-amber-300" aria-hidden />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-white md:text-3xl">تم رفض طلب ارتباطك</h1>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              عذراً، لقد قام الوكيل برفض طلبك للسبب التالي:{" "}
              <span className="font-semibold text-amber-100">{rej || "—"}</span>
            </p>
            <PrimaryButton
              type="button"
              className="mt-8 w-full max-w-sm"
              onClick={() => router.push("/player/select-agent")}
            >
              اختيار وكيل جديد
            </PrimaryButton>
          </div>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (acctUpper === "PENDING_APPROVAL") {
    const agentLabel = assignedAgent?.display_name || "الوكيل";
    return (
      <SidebarShell role="player">
        <PageHeader title="حسابك قيد التفعيل" subtitle="بانتظار إعداد الوكيل لحسابك على GoSport365." />
        <GlassCard className="mx-auto mt-8 max-w-xl border-primary/25 p-8 text-center md:p-10">
          <p className="text-lg leading-relaxed text-white/85">
            طلبك قيد المعالجة. الوكيل <span className="font-semibold text-cyan-200">{agentLabel}</span> يقوم حالياً
            بإعداد حسابك على gosport365.
          </p>
          <p className="mt-4 text-sm text-white/50">ستصلك إشعاراً عند اكتمال التفعيل — يمكنك تحديث الصفحة لاحقاً.</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  const isInactive = user.player_status !== "active";
  const accountActive = String(user.status ?? "").trim().toUpperCase() === "ACTIVE";

  return (
    <SidebarShell role="player">
      <PageHeader
        compact
        hideBranding
        title={
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-4xl">
              مرحباً بك، {user.username || "لاعب"} 👋
            </h1>
            {accountActive ? (
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                نشط
              </Badge>
            ) : (
              <Badge variant="secondary" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium">
                <span className="h-2 w-2 rounded-full bg-white/35" aria-hidden />
                حساب غير مفعل
              </Badge>
            )}
          </div>
        }
        subtitle="إليك ملخص نشاطك الأسبوعي وحالة حسابك مع الوكيل."
        action={<PrimaryButton onClick={changeAgent}>{t("changeAgent")}</PrimaryButton>}
      />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 xl:col-span-9">
          <AgentProfileCard
            agent={agentProfileData}
            actionType="deposit"
            onAction={() => router.push("/player/achat")}
          />
        </div>
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="h-full">
            <CardContent className="flex flex-col justify-center gap-4 py-8">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/45">آخر شحنة</p>
              <p className="text-center text-4xl font-black tabular-nums tracking-tight text-white">
                {latestOrder ? latestOrder.amount : 0}
                <span className="ms-2 text-xl font-semibold text-white/50">DH</span>
              </p>
              <p className="text-center text-xs text-white/45">
                {latestOrder ? `الحالة: ${latestOrder.status}` : "لم تقم بأي طلب بعد"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {isInactive && (
        <GlassCard className="mt-8 border-primary/25 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <UserCheck className="text-cyan-400" size={28} />
            <h2 className="text-2xl font-semibold text-white">اختر وكيلك المفضل</h2>
          </div>
          <p className="mt-2 text-sm text-white/60">اضغط مباشرة على بطاقة الوكيل لربط حسابك به والبدء في الشحن فوراً.</p>

          <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {availableAgents.map((agent) => (
              <Card
                key={agent.agentId}
                className={clsx(
                  "group relative overflow-hidden border-primary/25 bg-white/[0.03] shadow-lg backdrop-blur-md transition hover:border-cyan-400/35",
                  selectingId === agent.agentId && "pointer-events-none opacity-50"
                )}
              >
                <CardContent className="p-0">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!!selectingId}
                    onClick={() => !selectingId && void handleDirectSelectAgent(agent)}
                    className="h-auto min-h-[120px] w-full flex-col items-stretch justify-between gap-4 rounded-2xl p-5 text-start hover:bg-white/[0.06]"
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <p className="text-lg font-semibold text-white group-hover:text-cyan-300">{agent.display_name}</p>
                      <MousePointer2 size={16} className="shrink-0 text-white/25 opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="flex w-full items-center justify-between text-xs">
                      <span className="text-white/45">{agent.rating}% تقييم</span>
                      <span className="flex items-center gap-1.5 font-medium text-white/70">
                        <span
                          className={clsx(
                            "h-2 w-2 shrink-0 rounded-full",
                            agent.online ? "animate-pulse bg-emerald-400" : "bg-white/25"
                          )}
                        />
                        {agent.online ? "متصل" : "غير متصل"}
                      </span>
                    </div>
                  </Button>
                  {selectingId === agent.agentId ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="mt-8 p-6 md:p-8">
        <RevenueAreaChart title="إحصائيات الشحن الأسبوعية" data={chartData} />
      </GlassCard>
    </SidebarShell>
  );
}