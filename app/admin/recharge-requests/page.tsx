"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  GlassCard, 
  LoadingCard, 
  PageHeader, 
  PrimaryButton, 
  SidebarShell, 
  StatCard, 
  TextArea, 
  TextField 
} from "@/components/ui";

type RechargeRequest = {
  id: string;
  agentId: string;
  agentEmail: string;
  agentUsername?: string;
  amount: number;
  adminMethodName: string; 
  txHash?: string;
  proofUrl?: string; 
  note?: string;
  status: string;
  createdAt: string; 
  transferReference?: string;
  adminNote?: string;
  bonusAmount?: number;
  pendingBonusApplied?: number;
};

export default function AdminRechargeRequestsPage() {
  const [items, setItems] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("admin@mobcash.com");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/admin/topup-requests", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      setItems((data.requests || []).sort((a: RechargeRequest, b: RechargeRequest) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error("Failed to load requests", error);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    pending: items.filter(i => i.status === "pending").length,
    approved: items.filter(i => i.status === "approved").length,
    rejected: items.filter(i => i.status === "rejected").length,
  }), [items]);

  const act = async (requestId: string, action: "approve" | "reject") => {
    setBusyId(requestId);
    try {
      const res = await fetch("/api/admin/topup-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          adminEmail,
          transfer_reference: refs[requestId] || "",
          admin_note: notes[requestId] || "",
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed");
      
      await load();
      alert(`تمت العملية بنجاح: ${action}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="جاري تحميل طلبات الشحن..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="طلبات شحن رصيد الوكلاء"
        subtitle="راجع البيانات، تحقق من الوصل، وقم بالموافقة. النظام سيضيف 10% بونص تلقائياً عند التفعيل."
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="في انتظار المراجعة" value={String(stats.pending)} hint="Pending" />
        <StatCard label="تمت الموافقة" value={String(stats.approved)} hint="Approved" />
        <StatCard label="مرفوضة" value={String(stats.rejected)} hint="Rejected" />
        <StatCard label="إيميل المسؤول" value={adminEmail} hint="Logged in as" />
      </div>

      <div className="space-y-6">
        {items.map((item) => {
          const bonus = Math.floor(item.amount * 0.1);
          const total = item.amount + bonus;

          return (
            <GlassCard key={item.id} className="p-6">
              <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
                
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="text-cyan-400">@</span>
                        {item.agentUsername || item.agentEmail.split('@')[0]}
                      </h3>
                      <p className="text-sm text-white/50">{item.agentEmail}</p>
                    </div>
                    <div className={`rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                      item.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 
                      item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 
                      'bg-white/10 text-white/40'
                    }`}>
                      {item.status}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">المبلغ المطلوب</p>
                        <p className="text-2xl font-bold text-white">{item.amount} DH</p>
                      </div>
                      
                      {item.status === 'pending' ? (
                        <div className="pt-3 border-t border-white/5">
                          <p className="text-[10px] font-bold text-emerald-400/50 uppercase tracking-widest mb-1">سيتم شحن (شامل 10% بونص)</p>
                          <p className="text-xl font-bold text-emerald-400">{total} DH</p>
                          <p className="text-[10px] text-white/30 italic mt-1">* بونص تلقائي: {bonus} DH</p>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-white/5">
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">البونص الذي تم منحه</p>
                          <p className="text-lg font-bold text-emerald-400">+{item.bonusAmount || bonus} DH</p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/5 space-y-1 text-sm text-white/70">
                        <p>الطريقة: <span className="text-white font-medium">{item.adminMethodName}</span></p>
                        <p className="text-xs text-white/40">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/40 p-2">
                      {item.proofUrl ? (
                        <div className="group relative aspect-video w-full overflow-hidden rounded-2xl">
                          <img 
                            src={item.proofUrl} 
                            alt="Proof" 
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                          />
                          <a href={item.proofUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                            <span className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">تكبير الوصل</span>
                          </a>
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-2xl bg-white/5 text-xs text-white/20 italic">لا يوجد وصل</div>
                      )}
                    </div>
                  </div>

                  {(item.note || item.txHash) && (
                    <div className="rounded-2xl bg-white/5 p-4">
                      {item.note && (
                        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                          <p className="text-sm font-bold text-cyan-300 leading-relaxed">{item.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">إجراءات الإدارة</p>
                    <TextField
                      value={refs[item.id] || ""}
                      onChange={(e) => setRefs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="رقم المرجع / العملية"
                    />
                    <TextArea
                      rows={3}
                      value={notes[item.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="ملاحظة للوكيل..."
                    />
                  </div>

                  <div className="mt-6 flex gap-3">
                    <PrimaryButton 
                      onClick={() => act(item.id, "approve")} 
                      disabled={busyId === item.id || item.status !== "pending"}
                      className="flex-1 py-4 bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
                    >
                      {busyId === item.id ? "جاري المعالجة..." : "Approve + 10%"}
                    </PrimaryButton>
                    <button
                      onClick={() => act(item.id, "reject")}
                      disabled={busyId === item.id || item.status !== "pending"}
                      className="flex-1 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>

              </div>
            </GlassCard>
          );
        })}

        {!items.length && <GlassCard className="p-20 text-center text-white/30 italic">لا توجد طلبات حالياً</GlassCard>}
      </div>
    </SidebarShell>
  );
}