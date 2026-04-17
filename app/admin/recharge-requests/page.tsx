"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { toast } from "react-hot-toast";

export default function AdminRechargeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      const res = await fetch("/api/admin/topup-requests", { cache: "no-store" });
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e) { toast.error("Error loading requests"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRequests(); }, []);

  // 🟢 دالة الأزرار مصلحة 100%
  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`هل أنت متأكد من ${action === 'approve' ? 'قبول' : 'رفض'} هذا الطلب؟`)) return;
    try {
      const res = await fetch("/api/admin/topup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action: action })
      });
      
      if (res.ok) {
        toast.success(`تمت العملية بنجاح`);
        loadRequests(); // كيدير تحديث للصفحة
      } else {
        toast.error("فشل في تنفيذ العملية");
      }
    } catch (e) { toast.error("حدث خطأ"); }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="جاري تحميل الطلبات..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Recharge Requests" subtitle="مراجعة طلبات شحن الوكلاء." />
      
      <div className="mt-8 space-y-4">
        {requests.length === 0 && <p className="text-center text-white/30">لا توجد طلبات حالياً</p>}
        {requests.map((req) => (
          <GlassCard key={req.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg text-emerald-400">{req.amount} DH</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : req.status === 'rejected' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {req.status}
                </span>
              </div>
              <p className="text-sm text-white/70">الوكيل: {req.agentEmail}</p>
              <p className="text-xs text-white/50">الطريقة: {req.adminMethodName}</p>
              
              {/* 🟢 عرض الصورة للآدمين بوضوح */}
              {req.proofUrl ? (
                <div className="mt-3">
                  <p className="text-xs text-white/40 mb-1">إثبات الدفع (Proof):</p>
                  <a href={req.proofUrl} target="_blank" rel="noopener noreferrer" className="block relative w-32 h-32 rounded-lg overflow-hidden border border-white/20 hover:border-cyan-400 transition-all">
                    <img 
                      src={req.proofUrl} 
                      alt="Proof" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                      <ExternalLink className="text-white" />
                    </div>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-rose-400 mt-2">⚠️ لم يتم رفع إثبات</p>
              )}
              {req.note && <p className="text-xs text-amber-200 mt-2">ملاحظة: {req.note}</p>}
            </div>

            {/* 🟢 أزرار القبول والرفض */}
            {req.status === 'pending' && (
              <div className="flex gap-2 mt-4 md:mt-0">
                <button onClick={() => handleAction(req.id, 'approve')} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/40 transition-all">
                  <CheckCircle2 size={18} /> قبول
                </button>
                <button onClick={() => handleAction(req.id, 'reject')} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/40 transition-all">
                  <XCircle size={18} /> رفض
                </button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </SidebarShell>
  );
}