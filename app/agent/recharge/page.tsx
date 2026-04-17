"use client";

import { useEffect, useState } from "react";
import { Wallet, ListChecks, Clock, CheckCircle2, Upload } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";
import { toast } from "react-hot-toast";

export default function AgentRechargePage() {
  const [methods, setMethods] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ amount: "1000", adminMethodId: "", note: "", gosport365_username: "", proofUrl: "" });

  const loadData = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;
    const { agentId } = JSON.parse(saved);

    try {
      const [mRes, wRes, rRes] = await Promise.all([
        fetch("/api/admin/payment-methods-public"),
        fetch(`/api/agent/wallet?agentId=${agentId}`),
        fetch(`/api/agent/topup-requests?agentId=${agentId}`)
      ]);

      const mData = await mRes.json();
      const wData = await wRes.json();
      const rData = await rRes.json();

      setMethods(mData.methods || []);
      setWallet(wData.wallet);
      setRequests(rData.requests || []);
      
      if (mData.methods?.length > 0) {
        setForm(prev => ({ ...prev, adminMethodId: mData.methods[0].id }));
      }
    } catch (e) { toast.error("Error loading data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-proof", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setForm(prev => ({ ...prev, proofUrl: data.url }));
        toast.success("Proof uploaded");
      }
    } catch (e) { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const selectedMethod = methods.find(m => m.id === form.adminMethodId);

  const submit = async () => {
    if (!form.proofUrl) return toast.error("Please upload proof of payment");
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
          adminMethodName: selectedMethod?.methodName || selectedMethod?.method_name
        })
      });
      if (res.ok) {
        toast.success("Request sent!");
        setForm({ amount: "1000", adminMethodId: methods[0]?.id || "", note: "", gosport365_username: "", proofUrl: "" });
        loadData();
      }
    } catch (e) { toast.error("Error sending request"); }
    finally { setSaving(false); }
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Recharge Account" subtitle="Select a method and send proof." />
      
      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard label="Balance" value={`${wallet?.balance || 0} DH`} icon={<Wallet size={18}/>} />
        <StatCard label="Pending" value={String(requests.filter(r => r.status === 'pending').length)} icon={<Clock size={18}/>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] mt-8">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-4">New Request</h2>
          <div className="space-y-4">
            <TextField placeholder="GoSport365 Username" value={form.gosport365_username} onChange={e => setForm({...form, gosport365_username: e.target.value})} />
            <TextField type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            
            <SelectField value={form.adminMethodId} onChange={e => setForm({...form, adminMethodId: e.target.value})}>
              {methods.map(m => <option key={m.id} value={m.id}>{m.methodName || m.method_name}</option>)}
            </SelectField>

            <div className="border-2 border-dashed border-white/10 rounded-2xl p-4 text-center">
              <input type="file" id="proof" hidden onChange={handleFileUpload} accept="image/*" />
              <label htmlFor="proof" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="text-cyan-400" />
                <span className="text-sm">{uploading ? "Uploading..." : form.proofUrl ? "Proof Uploaded ✅" : "Upload Payment Proof"}</span>
              </label>
            </div>

            <TextArea placeholder="Note (Optional)" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
            <PrimaryButton onClick={submit} disabled={saving || uploading || !form.adminMethodId}>
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
                  <p className="text-xs text-white/30">{r.adminMethodName}</p>
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