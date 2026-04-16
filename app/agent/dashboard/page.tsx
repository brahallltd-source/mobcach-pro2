"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";
import { Users, ShoppingBag, Clock, ShieldAlert, XCircle, AlertTriangle } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = localStorage.getItem("mobcash_user");
        if (!saved) return void (window.location.href = "/login");
        
        const current: AgentUser = JSON.parse(saved);
        if (current.role !== "agent") return void (window.location.href = "/login");
        
        // 1. تحديد الـ ID الصحيح للبحث
        const idToSearch = current.agentId || current.id;
        if (!idToSearch) throw new Error("Missing Agent ID");

        // 2. جلب الحالة "الحية" من السيرفر
        const profileRes = await fetch(`/api/agent/profile?agentId=${encodeURIComponent(idToSearch)}`, { cache: "no-store" });
        
        if (!profileRes.ok) {
           if (profileRes.status === 404) throw new Error("الحساب غير موجود فـ الداتابيز");
           throw new Error("خطأ فـ الاتصال بالسيرفر");
        }

        const profileData = await profileRes.json();
        
        // تحديث الحالة فـ الـ State و LocalStorage
        const updatedUser = { ...current, status: profileData.status, username: profileData.username || current.username };
        setUser(updatedUser);
        localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));

        // 3. جلب البيانات فقط إذا كان الحساب نشطاً
        const isStatusActive = profileData.status?.toUpperCase() === "ACTIVE";
        
        if (isStatusActive) {
          const agentIdEnc = encodeURIComponent(idToSearch);
          const [walletData, ordersData, playersData, bonusData] = await Promise.all([
            fetch(`/api/agent/wallet?agentId=${agentIdEnc}`).then((r) => r.json()).catch(() => ({ wallet: null })),
            fetch(`/api/agent/orders?email=${encodeURIComponent(current.email)}`).then((r) => r.json()).catch(() => ({ orders: [] })),
            fetch(`/api/agent/my-players?agentId=${agentIdEnc}`).then((r) => r.json()).catch(() => ({ count: 0 })), 
            fetch(`/api/agent/bonus?agentId=${agentIdEnc}`).then((r) => r.json()).catch(() => ({ profile: null })),
          ]);
          
          setWallet(walletData.wallet);
          setOrders(ordersData.orders || []);
          setPlayersCount(playersData.count || 0);
          setBonus(bonusData.profile);
        }
      } catch (err: any) {
        console.error("Dashboard Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const newOrders = orders.filter((item) => item.status === "pending_payment" || item.status === "proof_uploaded").length;
  const waitingOrders = orders.filter((item) => item.status === "agent_approved_waiting_player").length;
  const flagged = orders.filter((item) => item.status === "flagged_for_review").length;

  const chartData = useMemo(() => [
    { name: "New", value: newOrders },
    { name: "Waiting", value: waitingOrders },
    { name: "Completed", value: orders.filter(i => i.status === "completed").length },
  ], [orders, newOrders, waitingOrders]);

  if (loading) return <SidebarShell role="agent"><LoadingCard text="جاري تحديث البيانات..." /></SidebarShell>;
  
  if (error) return (
    <SidebarShell role="agent">
      <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-red-500/20">
        <AlertTriangle size={64} className="mx-auto text-red-500 mb-6" />
        <h2 className="text-2xl font-bold">عذراً، وقع خطأ</h2>
        <p className="mt-4 text-white/70">{error}</p>
        <PrimaryButton onClick={() => window.location.reload()} className="mt-6">إعادة المحاولة</PrimaryButton>
      </GlassCard>
    </SidebarShell>
  );

  if (!user) return null;

  // 🟠 حالة قيد المراجعة
  const statusUpper = user.status?.toUpperCase();
  if (statusUpper === "PENDING" || statusUpper === "ACCOUNT_CREATED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-amber-500/20">
          <Clock size={64} className="mx-auto text-amber-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold text-amber-400">طلبك قيد المراجعة</h2>
          <p className="mt-4 text-lg text-white/70">
            يتم الآن مراجعة حسابك من طرف الإدارة. ستتمكن من الوصول للوحة التحكم كاملة فور تفعيل حسابك (غالباً في أقل من 24 ساعة).
          </p>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🔴 حالة الرفض
  if (statusUpper === "REJECTED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center max-w-2xl mx-auto mt-10 border-red-500/30 bg-red-500/5">
          <XCircle size={64} className="mx-auto text-red-500 mb-6" />
          <h2 className="text-3xl font-bold text-red-400">نأسف، تم رفض طلبك</h2>
          <p className="mt-4 text-lg text-white/70">
            لم يتم قبول طلب انضمامك كوكيل حالياً. يمكنك الاستمرار في استخدام المنصة كلاعب.
          </p>
          <Link href="/registre/player" className="mt-8 block">
            <PrimaryButton className="w-full">سجل كلاعب الآن</PrimaryButton>
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  // 🟢 الداشبورد العادي
  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`مرحباً بك، ${user.username || "أيها الوكيل"} 👋`}
        subtitle="إليك ملخص نشاطك اليومي."
      />
      
      <div className="space-y-6">
        <GlassCard className="p-5 md:p-7">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">الإحصائيات الحالية</p>
              <h2 className="mt-3 text-2xl font-semibold md:text-4xl">إدارة العمليات</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/agent/recharge"><PrimaryButton>شحن المحفظة</PrimaryButton></Link>
                <Link href="/agent/my-players" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10">اللاعبين النشطين</Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="رصيد المحفظة" value={`${wallet?.balance || 0} DH`} hint="متوفر للشحن" />
              <Link href="/agent/orders"><StatCard label="طلبات جديدة" value={String(newOrders)} hint="تحتاج مراجعة" /></Link>
              <Link href="/agent/my-players"><StatCard label="لاعبيني" value={String(playersCount)} hint="إجمالي المسجلين" /></Link>
              <Link href="/agent/orders"><StatCard label="في الانتظار" value={String(waitingOrders)} hint="بانتظار تأكيد اللاعب" /></Link>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <GlassCard className="p-5 md:p-7">
            <RevenueAreaChart title="تحليل المبيعات" data={chartData} />
          </GlassCard>
          
          <div className="space-y-6">
            <GlassCard className="p-5 md:p-7">
              <h3 className="text-xl font-semibold text-cyan-200">نظام المكافآت</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/60">بونيس معلق:</span>
                  <span className="font-bold">{bonus?.pendingBonus || 0} DH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">حجم التداول:</span>
                  <span className="font-bold">{bonus?.volume || 0} DH</span>
                </div>
              </div>
              <Link href="/agent/bonus" className="mt-4 block text-center py-2 text-sm bg-white/5 rounded-xl border border-white/10">التفاصيل</Link>
            </GlassCard>

            {flagged > 0 && (
              <GlassCard className="p-5 border-l-4 border-amber-500 bg-amber-500/5">
                <h3 className="text-amber-500 font-bold flex items-center gap-2">
                  <ShieldAlert size={18} /> طلبات مشبوهة ({flagged})
                </h3>
                <Link href="/agent/orders?filter=flagged" className="text-sm underline mt-2 block">راجع الطلبات الآن</Link>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}