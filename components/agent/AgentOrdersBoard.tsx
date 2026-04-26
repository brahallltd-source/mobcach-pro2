"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, MessageCircle, ArrowRight } from "lucide-react";
import {
  EmptyState,
  GlassCard,
  LoadingCard,
  PageHeader,
  StatCard,
  StatusBadge,
  TextField,
} from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  playerEmail: string;
  gosportUsername?: string;
  paymentMethodName?: string;
};

type FilterType = "all" | "new" | "waiting" | "completed";

/** Orders list without `SidebarShell` (embedded in Add Requests tab, etc.). */
export function AgentOrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");

  const load = (email: string) =>
    fetch(`/api/agent/orders?email=${encodeURIComponent(email)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) {
        if (!cancelled) redirectToLogin();
        return;
      }
      if (cancelled) return;
      const email = String(u.email);
      load(email).finally(() => { if (!cancelled) setLoading(false); });
      timer = setInterval(() => { if (!cancelled) void load(email); }, 10000);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  // إحصائيات سريعة للوحة التحكم
  const newOrders = useMemo(
    () => orders.filter((item) => ["proof_uploaded", "pending_payment"].includes(item.status)).length,
    [orders]
  );

  const waitingPlayer = useMemo(
    () => orders.filter((item) => item.status === "agent_approved_waiting_player").length,
    [orders]
  );

  const completed = useMemo(
    () => orders.filter((item) => item.status === "completed").length,
    [orders]
  );

  // منطق الفلترة والبحث
  const filteredOrders = useMemo(() => {
    let base = orders;

    if (filter === "new") {
      base = orders.filter((item) => ["proof_uploaded", "pending_payment"].includes(item.status));
    }
    if (filter === "waiting") {
      base = orders.filter((item) => item.status === "agent_approved_waiting_player");
    }
    if (filter === "completed") {
      base = orders.filter((item) => item.status === "completed");
    }

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((item) =>
      item.playerEmail.toLowerCase().includes(q) ||
      String(item.gosportUsername || "").toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }, [orders, filter, query]);

  if (loading) {
    return <LoadingCard text="Fetching orders..." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders Management"
        subtitle="Manage recharge requests, chat with players, and verify payments in one place."
      />

      {/* بطاقات الإحصائيات */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Orders" value={String(orders.length)} hint="Lifetime history" />
        <StatCard label="Action Needed" value={String(newOrders)} hint="Unprocessed requests" />
        <StatCard label="Waiting Player" value={String(waitingPlayer)} hint="Pending player confirmation" />
        <StatCard label="Successful" value={String(completed)} hint="Completed recharges" />
      </div>

      {/* شريط البحث والفلترة */}
      <GlassCard className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={16} />
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email, username or order ID..."
              className="pl-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "new", label: `New (${newOrders})` },
              { key: "waiting", label: "Waiting" },
              { key: "completed", label: "Completed" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as FilterType)}
                className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                  filter === item.key
                    ? "bg-white text-slate-950 shadow-lg shadow-white/10"
                    : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* قائمة الطلبات */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.id} className="relative group">
            {/* بطاقة الطلب - تفتح صفحة التفاصيل */}
            <Link href={`/agent/orders/${order.id}`}>
              <GlassCard className="p-5 transition-all duration-300 hover:bg-white/[0.08] hover:translate-x-1 pr-24">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-bold text-white/90">{order.playerEmail}</p>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-white/50">
                      <p>Method: <span className="text-white/70">{order.paymentMethodName || "Pending"}</span></p>
                      <p>User: <span className="text-cyan-400 font-medium">{order.gosportUsername || "Pending"}</span></p>
                    </div>
                    <p className="mt-1 text-xs text-white/30 uppercase tracking-widest">
                      ID: {order.id.split('-')[0]} • {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{order.amount} <span className="text-xs font-normal text-white/40">DH</span></p>
                  </div>
                </div>
              </GlassCard>
            </Link>

            {/* زر الدردشة المباشرة (عائم فوق البطاقة) */}
            <Link
              href={`/agent/chat/${order.id}`}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all duration-300 shadow-xl"
              title="Open Chat"
            >
              <MessageCircle size={22} />
              
              {/* الإشعار الأحمر النابض - يظهر فقط في حالة رفع إثبات جديد يحتاج مراجعة */}
              {order.status === "proof_uploaded" && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-[#0B0F19]"></span>
                </span>
              )}
            </Link>
          </div>
        ))}

        {/* حالة عدم وجود طلبات */}
        {!filteredOrders.length && (
          <EmptyState
            title="No orders found"
            subtitle="Try adjusting your filters or search query to find specific records."
          />
        )}
      </div>
    </div>
  );
}