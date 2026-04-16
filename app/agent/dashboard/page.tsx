"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";
import { Users, ShoppingBag, Clock, ShieldAlert, XCircle } from "lucide-react";

type AgentUser = { id: string; role: string; email: string; agentId?: string; username?: string; status?: string };
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

    // 🟢 السر هنا: كنجيبو البيانات "الحية" من السيرفر باش نعرفو واش تقبل ولا ترفض
    const loadLiveStatus = async () => {
      try {
        const agentIdEnc = encodeURIComponent(current.agentId || "");
        
        // 1. كنجيبو البروفايل باش نعرفو الـ Status الحقيقي دابا
        const profileRes = await fetch(`/api/agent/profile?agentId=${agentIdEnc}`, { cache: "no-store" });
        const profileData = await profileRes.json();
        
        // تحديث الـ User والـ LocalStorage بالحالة الجديدة
        const updatedUser = { ...current, status: profileData.status };
        setUser(updatedUser);
        localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));

        // 2. كمل جلب باقي البيانات لو كان مقبول
        if (profileData.status === "ACTIVE" || profileData.status === "active") {
          const [walletData, ordersData, playersData, bonusData] = await Promise.all([
            fetch(`/api/agent/wallet?agentId=${agentIdEnc}`).then((r) => r.json()),
            fetch(`/api/agent/orders?email=${encodeURIComponent(current.email)}`).then((r) => r.json()),
            fetch(`/api/agent/my-players?agentId=${agentIdEnc}`).then((r) => r.json()), 
            fetch(`/api/agent/bonus?agentId=${agentIdEnc}`).then((r) => r.json()),
          ]);
          
          setWallet(walletData.wallet || null);
          setOrders(ordersData.orders || []);
          setPlayersCount(playersData.count || 0);
          setBonus(bonusData.profile || null);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLiveStatus();
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

  // 🟠 حالة الوكيل قيد المراجعة
  if (user?.status === "pending" || user?.status === "account_created") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-amber-500/20">
          <Clock size={64} className="mx-auto text-amber-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold text-amber-400">طلبك قيد المراجعة</h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed">
            تم استلام طلبك للعمل كوكيل بنجاح. ستقوم الإدارة بمراجعة بياناتك والرد عليك في غضون <span className="font-bold text-white">48 ساعة</span>.
          </p>
          <p className="mt-2 text-sm text-white/40 italic">يرجى المحاولة لاحقاً بعد مراجعة الوثائق.</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🔴 حالة الوكيل المرفوض (Redirect to Player Registration)
  if (user?.status === "rejected" || user?.status === "REJECTED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-red-500/30 bg-red-500/5">
          <XCircle size={64} className="mx-auto text-red-500 mb-6" />
          <h2 className="text-3xl font-bold text-red-400">نأسف، تم رفض طلبك</h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed">
            بعد مراجعة بياناتك، تعذر قبول حسابك كوكيل في الوقت الحالي. يمكنك دائماً استخدام المنصة كلاعب.
          </p>
          <div className="mt-8">
            <Link href="/registre/player">
              <PrimaryButton className="px-8 py-4 text-lg w-full">التسجيل كلاعب الآن</PrimaryButton>
            </Link>
          </div>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🟢 الداشبورد العادي (مقبول)
  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`مرحباً بك، ${user.username || "أيها الوكيل"} 👋`}
        subtitle="إليك نظرة شاملة على عملياتك اليومية وأداء محفظتك."
      />
      {/* ... باقي الكود ديال الداشبورد اللي عندك ... */}
      <GlassCard className="p-5 md:p-7">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">لوحة التحكم</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight md:text-4xl">
              راقب طلباتك وقم بإدارة لاعبيك بكفاءة عالية.
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/agent/recharge"><PrimaryButton>شحن الرصيد</PrimaryButton></Link>
              <Link href="/agent/my-players" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">عرض اللاعبين</Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Wallet balance" value={`${wallet?.balance || 0} DH`} hint="رصيدك المتوفر حالياً" />
            <Link href="/agent/orders"><StatCard label="New Orders" value={String(newOrders)} hint="طلبات في انتظارك" /></Link>
            <Link href="/agent/my-players"><StatCard label="My Players" value={String(playersCount)} hint="إدارة اللاعبين المسجلين" /></Link>
            <Link href="/agent/orders"><StatCard label="Waiting Orders" value={String(waitingOrders)} hint="طلبات قيد المعالجة" /></Link>
          </div>
        </div>
      </GlassCard>
      {/* ... التكملة ديال الإحصائيات ... */}
    </SidebarShell>
  );
}