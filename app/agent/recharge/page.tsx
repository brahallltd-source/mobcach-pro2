"use client";

import { useEffect, useState } from "react";
import { Wallet, ListChecks, Clock, CheckCircle2 } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";
import { toast } from "react-hot-toast";

export default function AgentRechargePage() {
  const [methods, setMethods] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "1000", admin_method_id: "", note: "", gosport365_username: "" });

  const loadData = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;
    const { agentId } = JSON.parse(saved);

    try {
      const [mRes, wRes, rRes] = await Promise.all([
        fetch("/api/admin/payment-methods-public", { cache: "no-store" }),
        fetch(`/api/agent/wallet?agentId=${agentId}`, { cache: "no-store" }),
        fetch(`/api/agent/topup-requests?agentId=${agentId}`, { cache: "no-store" })
      ]);

      const mData = await mRes.json();
      const wData = await wRes.json();
      const rData = await rRes.json();

      setMethods(mData.methods || []);
      setWallet(wData.wallet);
      setRequests(rData.requests || []);
      
      if (mData.methods?.length > 0) {
        setForm(prev => ({ ...prev, admin_method_id: mData.methods[0].id }));
      }
    } catch (e) { toast.error("Error loading data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const selectedMethod = methods.find(m => m.id === form.admin_method_id);

  const submit = async () => {
    setSaving(true);
    const saved = localStorage.getItem("mobcash_user");
    const { agentId, email } = JSON.parse(saved!);

    try {
      const res = await fetch("/api/agent/topup-requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          agentId,
          agentEmail: email,
          admin_method_name: selectedMethod?.method_name
        })
      });
      if (res.ok) {
        toast.success("Request sent!");
        loadData();
      }
    } catch (e) { toast.error("Error"); }
    finally { setSaving(false); }
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Recharge Account" subtitle="Select a method and send proof." />
      
      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard label="Balance" value={`${wallet?.balance || 0} DH`} icon={<Wallet size={18}/>} />
        <StatCard label="Methods" value={String(methods.length)} icon={<ListChecks size={18}/>} />
        <StatCard label="Pending" value={String(requests.filter(r => r.status === 'pending').length)} icon={<Clock size={18}/>} />
        <StatCard label="Approved" value={String(requests.filter(r => r.status === 'approved').length)} icon={<CheckCircle2 size={18}/>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] mt-8">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-4">New Request</h2>
          <div className="space-y-4">
            <TextField placeholder="GoSport365 Username" value={form.gosport365_username} onChange={e => setForm({...form, gosport365_username: e.target.value})} />
            <TextField type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            
            <SelectField value={form.admin_method_id} onChange={e => setForm({...form, admin_method_id: e.target.value})}>
              {methods.length === 0 && <option>No methods available</option>}
              {methods.map(m => <option key={m.id} value={m.id}>{m.method_name}</option>)}
            </SelectField>

            {selectedMethod && (
              <div className="bg-white/5 p-4 rounded-2xl text-sm border border-white/10">
                <p className="text-cyan-400 font-bold mb-2">Payment Details:</p>
                {selectedMethod.account_name && <p>Name: {selectedMethod.account_name}</p>}
                {selectedMethod.rib && <p className="font-mono">RIB: {selectedMethod.rib}</p>}
                {selectedMethod.wallet_address && <p className="break-all font-mono">Address: {selectedMethod.wallet_address}</p>}
              </div>
            )}

            <TextArea placeholder="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
            <PrimaryButton onClick={submit} disabled={saving || !form.admin_method_id}>
              {saving ? "Sending..." : "Send Request"}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-4">History</h2>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="p-4 bg-white/5 rounded-2xl flex justify-between items-center border border-white/10">
                <div>
                  <p className="font-bold">{r.amount} DH</p>
                  <p className="text-xs text-white/30">{r.admin_method_name}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}