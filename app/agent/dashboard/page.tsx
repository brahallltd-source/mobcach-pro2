"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";
import { Users, ShoppingBag, Clock, ShieldAlert, XCircle } from "lucide-react";

// زدنا حالة الوكيل (status) باش نقدرو نتحكمو فـ باج الانتظار
type AgentUser = { role: string; email: string; agentId?: string; username?: string; status?: string };
type Wallet = { balance: number };
type Order = { id: string; status: string; amount: number };
type BonusProfile = { pendingBonus?: number; volume?: number; energy?: number; completedOrders?: number };

export default function AgentDashboardPage() {
  const [user, setUser] = useState<AgentUser | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [playersCount, setPlayersCount] = useState(0); 
  const [bonus, setBonus] = useState<BonusProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: AgentUser = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);

    const agentIdEnc = encodeURIComponent(current.agentId || "");

    Promise.all([
      fetch(`/api/agent/wallet?agentId=${agentIdEnc}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/agent/orders?email=${encodeURIComponent(current.email)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/agent/my-players?agentId=${agentIdEnc}`, { cache: "no-store" }).then((r) => r.json()), 
      fetch(`/api/agent/bonus?agentId=${agentIdEnc}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([walletData, ordersData, playersData, bonusData]) => {
      setWallet(walletData.wallet || null);
      setOrders(ordersData.orders || []);
      setPlayersCount(playersData.count || 0);
      setBonus(bonusData.profile || null);
    }).finally(() => setLoading(false));
  }, []);

  const newOrders = orders.filter((item) => item.status === "pending_payment" || item.status === "proof_uploaded").length;
  const waitingOrders = orders.filter((item) => item.status === "agent_approved_waiting_player").length;
  const flagged = orders.filter((item) => item.status === "flagged_for_review").length;

  const chartData = useMemo(() => {
    return [
      { name: "New", value: newOrders },
      { name: "Waiting", value: waitingOrders },
      { name: "Completed", value: orders.filter(i => i.status === "completed").length },
    ];
  }, [orders, newOrders, waitingOrders]);

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading agent dashboard..." /></SidebarShell>;
  if (!user) return null;

  // 🟢 حالة الوكيل قيد المراجعة (يلاه تسجل)
  if (user?.status === "pending" || user?.status === "account_created") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-amber-500/20">
          <Clock size={64} className="mx-auto text-amber-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold text-amber-400">طلبك قيد المراجعة</h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed">
            تم استلام طلبك للعمل كوكيل بنجاح. ستقوم الإدارة بمراجعة بياناتك والرد عليك في غضون <span className="font-bold text-white">24 ساعة كحد أقصى</span>.
          </p>
          <p className="mt-2 text-sm text-white/40">المرجو التحقق من حسابك لاحقاً.</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🔴 حالة الوكيل المرفوض
  if (user?.status === "rejected" || user?.status === "REJECTED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-red-500/30 bg-red-500/5">
          <XCircle size={64} className="mx-auto text-red-500 mb-6" />
          <h2 className="text-3xl font-bold text-red-400">تم رفض طلبك</h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed">
            عذراً، لم توافق الإدارة على طلبك للانضمام كوكيل في الوقت الحالي. يمكنك التسجيل واستخدام المنصة كلاعب عادي.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/registre/player">
              <PrimaryButton className="px-8 py-4 text-lg">التسجيل كلاعب بدلاً من ذلك</PrimaryButton>
            </Link>
          </div>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🟢 الداشبورد العادي للوكيل المقبول
  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`مرحباً بك، ${user.username || "أيها الوكيل"} 👋`}
        subtitle="إليك نظرة شاملة على عملياتك اليومية وأداء محفظتك."
      />

      <GlassCard className="p-5 md:p-7">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">لوحة التحكم</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight md:text-4xl">
              راقب طلباتك وقم بإدارة لاعبيك بكفاءة عالية.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
              تأكد دائماً من شحن محفظتك لتتمكن من استقبال طلبات جديدة. يمكنك الآن تتبع عدد اللاعبين المسجلين تحت حسابك مباشرة.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/agent/recharge"><PrimaryButton>شحن الرصيد</PrimaryButton></Link>
              <Link href="/agent/my-players" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">عرض اللاعبين</Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard 
              label="Wallet balance" 
              value={`${wallet?.balance || 0} DH`} 
              hint="رصيدك المتوفر حالياً" 
            />
            
            {/* 🟢 غلفنا الخانات بـ Link باش نحيدو مشكل TypeScript ديال onClick */}
            <Link href="/agent/orders" className="block transition hover:scale-[1.02]">
              <StatCard 
                label="New Orders" 
                value={String(newOrders)} 
                hint="طلبات في انتظارك" 
              />
            </Link>

            <Link href="/agent/my-players" className="block transition hover:scale-[1.02]">
              <StatCard 
                label="My Players" 
                value={String(playersCount)} 
                hint="إدارة اللاعبين المسجلين" 
              />
            </Link>

            <Link href="/agent/orders" className="block transition hover:scale-[1.02]">
              <StatCard 
                label="Waiting Orders" 
                value={String(waitingOrders)} 
                hint="طلبات قيد المعالجة" 
              />
            </Link>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <GlassCard className="p-5 md:p-7">
          <RevenueAreaChart title="إحصائيات الطلبات" data={chartData} />
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-5 md:p-7">
            <h3 className="text-xl font-semibold text-cyan-200">Bonus progress</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/65">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Pending bonus:</span>
                <span className="font-semibold text-white">{bonus?.pendingBonus || 0} DH</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Volume:</span>
                <span className="font-semibold text-white">{bonus?.volume || 0} DH</span>
              </div>
              <div className="flex justify-between">
                <span>Energy:</span>
                <span className="font-semibold text-white">{bonus?.energy || 0}</span>
              </div>
            </div>
            <Link href="/agent/bonus" className="mt-5 block w-full text-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">فتح صفحة المكافآت</Link>
          </GlassCard>

          <GlassCard className="p-5 md:p-7 border-l-4 border-amber-500">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <ShieldAlert size={20} className="text-amber-500" />
              Flagged Orders
            </h3>
            <p className="mt-2 text-3xl font-bold text-white">{flagged}</p>
            <p className="text-sm text-white/50 mt-1">يرجى مراجعة هذه الطلبات فوراً.</p>
            <Link href="/agent/orders?filter=flagged" className="mt-4 block text-sm font-semibold text-amber-500 hover:underline">عرض الطلبات المشبوهة ←</Link>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}