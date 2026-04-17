"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, Clock } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { toast } from "react-hot-toast";

export default function AdminRechargeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      const res = await fetch("/api/admin/topup-requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e) { toast.error("Error loading requests"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRequests(); }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch("/api/admin/update-topup-status", {
        method: "POST",
        body: JSON.stringify({ requestId: id, status })
      });
      if (res.ok) {
        toast.success(`Request ${status}`);
        loadRequests();
      }
    } catch (e) { toast.error("Action failed"); }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading Requests..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Recharge Requests" subtitle="Review and approve agent top-up requests." />
      
      <div className="mt-8 space-y-4">
        {requests.length === 0 && <p className="text-center text-white/30">No pending requests</p>}
        {requests.map((req) => (
          <GlassCard key={req.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{req.amount} DH</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                  {req.status}
                </span>
              </div>
              <p className="text-sm text-white/50">{req.agentEmail} • {req.adminMethodName}</p>
              {req.proofUrl && (
                <a href={req.proofUrl} target="_blank" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                  <ExternalLink size={12} /> View Payment Proof
                </a>
              )}
            </div>

            {req.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(req.id, 'approved')} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30">
                  <CheckCircle2 size={18} /> Approve
                </button>
                <button onClick={() => handleAction(req.id, 'rejected')} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30">
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