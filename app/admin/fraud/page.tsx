"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard, StatusBadge, TextArea } from "@/components/ui";

// 🟢 تعديل الـ Type باش يطابق السكيما ديالنا
type FraudFlag = {
  id: string;
  orderId: string;
  type: string;
  note: string;
  score: number;
  resolved: boolean;
  createdAt: string;
  order: {
    amount: number;
    status: string;
    proofUrl?: string;
    player: { email: string; username: string };
    agent: { email: string; username: string };
  };
};

type Summary = { suspiciousOrders: number; pendingFlags: number; highRisk: number };
type Filter = "all" | "high" | "open" | "resolved";

export default function AdminFraudPage() {
  const [items, setItems] = useState<FraudFlag[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FraudFlag | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [actionNote, setActionNote] = useState("");
  const [busy, setBusy] = useState(false);

  const emptySummary = (): Summary => ({ suspiciousOrders: 0, pendingFlags: 0, highRisk: 0 });

  const load = async () => {
    try {
      const res = await fetch("/api/admin/fraud", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        console.error("API Error:", res.status, res.statusText);
        setItems([]);
        setSummary(emptySummary());
        setSelected(null);
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        console.error("Non-JSON fraud response:", ct);
        setItems([]);
        setSummary(emptySummary());
        setSelected(null);
        return;
      }
      let data: { items?: FraudFlag[]; summary?: Summary | null };
      try {
        data = (await res.json()) as typeof data;
      } catch (e) {
        console.error("JSON parse error (fraud)", e);
        setItems([]);
        setSummary(emptySummary());
        setSelected(null);
        return;
      }
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setSummary(data.summary && typeof data.summary === "object" ? data.summary : emptySummary());
      setSelected((current) => {
        const next = list.find((item) => item.id === current?.id);
        return next || list[0] || null;
      });
    } catch (error) {
      console.error("Failed to load fraud items", error);
      setItems([]);
      setSummary(emptySummary());
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "high") return items.filter((item) => item.score >= 70);
    if (filter === "open") return items.filter((item) => !item.resolved);
    if (filter === "resolved") return items.filter((item) => item.resolved);
    return items;
  }, [filter, items]);

  const runAction = async (action: "resolve" | "reopen") => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flagId: selected.id,
          orderId: selected.orderId,
          action,
          note: actionNote,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      let data: { message?: string } = {};
      if (ct.includes("application/json")) {
        try {
          data = (await res.json()) as typeof data;
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) {
        alert(data.message || "Action failed");
        return;
      }
      await load();
      setActionNote("");
      alert(data.message || "Updated successfully");
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading fraud center..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Fraud center" subtitle="إدارة البلاغات والطلبات المشبوهة. قم بمراجعة الإثباتات وحل النزاعات بين اللاعب والوكيل." />
      
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Suspicious orders" value={String(summary?.suspiciousOrders || 0)} hint="الطلبات قيد المراجعة" />
        <StatCard label="Open flags" value={String(summary?.pendingFlags || 0)} hint="البلاغات غير المحلولة" />
        <StatCard label="High risk" value={String(summary?.highRisk || 0)} hint="بلاغات ذات أولوية قصوى" />
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          ["all", "All queue"],
          ["high", "High risk"],
          ["open", "Open cases"],
          ["resolved", "Resolved"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as Filter)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${filter === key ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <GlassCard className="p-4 md:p-6 h-[600px] overflow-y-auto">
          <div className="flex items-center gap-3"><ShieldAlert className="text-rose-300" size={18} /><h2 className="text-2xl font-semibold">Flag queue</h2></div>
          <div className="mt-4 space-y-3">
            {filteredItems.map((item) => (
              <button key={item.id} onClick={() => setSelected(item)} className={`w-full rounded-3xl border p-4 text-left transition ${selected?.id === item.id ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/40">{item.order.player.email}</p>
                    <h3 className="mt-1 text-lg font-semibold">Order {item.orderId.split('-')[0]}</h3>
                    <p className="mt-2 text-sm text-white/55">Agent: {item.order.agent.username} • {item.order.amount} DH</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${item.score >= 70 ? "text-rose-300" : item.score >= 40 ? "text-amber-300" : "text-emerald-300"}`}>{item.score}/100</p>
                    <StatusBadge status={item.order.status} />
                  </div>
                </div>
                {item.resolved ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"><CheckCircle2 size={12} /> resolved</p> : null}
              </button>
            ))}
            {!filteredItems.length ? <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/60">No suspicious orders.</div> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8 h-[600px] overflow-y-auto">
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-white/40">تفاصيل البلاغ</p>
                  <h2 className="mt-1 text-3xl font-semibold">Order {selected.orderId.split('-')[0]}</h2>
                  <p className="mt-2 text-sm text-white/55">Player: {selected.order.player.email} • Agent: {selected.order.agent.email}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-amber-300"><AlertTriangle size={16} /> سبب الإبلاغ (رسالة اللاعب/الوكيل)</div>
                <p className="mt-3 text-sm leading-6 text-white/70">{selected.note || "لا يوجد وصف."}</p>
              </div>

              {selected.order.proofUrl ? (
                <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/20">
                  <p className="p-3 text-xs uppercase tracking-[0.2em] text-white/50 bg-white/5">وصل التحويل (Proof)</p>
                  <Image src={selected.order.proofUrl} alt="Proof" width={1400} height={900} className="h-auto w-full object-cover" />
                </div>
              ) : (
                <div className="rounded-[30px] border border-dashed border-white/10 bg-black/20 p-10 text-center text-white/50">لا يوجد وصل تحويل مرفق.</div>
              )}

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">قرار الإدارة (Admin Action)</p>
                <TextArea rows={3} value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="اكتب قرارك هنا (مثال: تم قبول الوصل، تم إلغاء الطلب...)" className="mt-3" />
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton onClick={() => runAction("resolve")} disabled={busy}>إغلاق البلاغ (Resolve)</PrimaryButton>
                  <button onClick={() => runAction("reopen")} disabled={busy} className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-rose-400 disabled:opacity-60">إعادة الفتح (Reopen)</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-10 text-center text-white/60">اختر بلاغاً لعرض التفاصيل.</div>
          )}
        </GlassCard>
      </div>
    </SidebarShell>
  );
}