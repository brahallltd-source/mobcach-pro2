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

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      // الـ API ديالك كيتسنى action و requestId
      const res = await fetch("/api/admin/topup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action: action, adminEmail: "admin" })
      });
      
      if (res.ok) {
        toast.success(`Request ${action}d successfully`);
        loadRequests();
      } else {
        toast.error("Action failed");
      }
    } catch (e) { toast.error("Error executing action"); }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading Requests..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Recharge Requests" subtitle="Review and approve agent top-up requests." />
      
      <div className="mt-8 space-y-4">
        {requests.length === 0 && <p className="text-center text-white/30">No pending requests</p>}
        {requests.map((req) => (
          <GlassCard key={req.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{req.amount} DH</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : req.status === 'rejected' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {req.status}
                </span>
              </div>
              <p className="text-sm text-white/50">{req.agentUsername} ({req.agentEmail}) • {req.adminMethodName}</p>
              
              {/* 🟢 منطقة عرض الصورة للآدمين */}
              {req.proofUrl ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Proof of Payment:</p>
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 group">
                    <img 
                      src={req.proofUrl} 
                      alt="Payment Proof" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                    <a 
                      href={req.proofUrl} 
                      target="_blank" 
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink size={20} className="text-white" />
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-400 italic">No proof uploaded</p>
              )}
              {req.note && <p className="text-xs text-white/40">Note: {req.note}</p>}
            </div>

            {req.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(req.id, 'approve')} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30">
                  <CheckCircle2 size={18} /> Approve
                </button>
                <button onClick={() => handleAction(req.id, 'reject')} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30">
                  <XCircle size={18} /> Reject
                </button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </SidebarShell>
  );
}