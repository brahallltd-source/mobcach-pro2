"use client";

import { useEffect, useState } from "react";
import { Wallet, ListChecks, Clock, CheckCircle2, Upload, FileImage } from "lucide-react"; // زدت Upload و FileImage
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";
import { toast } from "react-hot-toast";

export default function AgentRechargePage() {
  const [methods, setMethods] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false); // حالة الرفع
  const [form, setForm] = useState({ 
    amount: "1000", 
    admin_method_id: "", 
    note: "", 
    gosport365_username: "",
    proof_url: "" // حقل الصورة
  });

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

  // 🟢 دالة رفع الصورة
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("context", "recharge_request");

    try {
      const res = await fetch("/api/upload-transaction-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setForm(prev => ({ ...prev, proof_url: data.proof.url }));
        toast.success("تم رفع الوصل بنجاح ✅");
      } else {
        toast.error(data.message || "فشل الرفع");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء الرفع");
    } finally {
      setUploading(false);
    }
  };

  const selectedMethod = methods.find(m => m.id === form.admin_method_id);

  const submit = async () => {
    if (!form.proof_url) {
      return toast.error("يرجى رفع صورة الوصل أولاً!");
    }
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
          admin_method_name: selectedMethod?.methodName || selectedMethod?.method_name
        })
      });
      if (res.ok) {
        toast.success("Request sent!");
        setForm(prev => ({ ...prev, proof_url: "", note: "", gosport365_username: "" })); // ريست للفورم
        loadData();
      }
    } catch (e) { toast.error("Error sending request"); }
    finally { setSaving(false); }
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Recharge Account" subtitle="Select a method and send proof." />
      
      {/* الـ Stats */}
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
              {methods.map(m => <option key={m.id} value={m.id}>{m.methodName || m.method_name}</option>)}
            </SelectField>

            {/* 🟢 منطقة رفع الوصل */}
            <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-6 transition-all hover:bg-white/5">
              <input 
                type="file" 
                id="proof-upload" 
                className="hidden" 
                onChange={handleFileUpload}
                accept="image/*"
                disabled={uploading}
              />
              <label 
                htmlFor="proof-upload" 
                className="cursor-pointer flex flex-col items-center gap-2 text-sm text-white/50"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                ) : form.proof_url ? (
                  <>
                    <CheckCircle2 className="text-emerald-400" size={32} />
                    <span className="text-emerald-400 font-bold">تم اختيار الصورة ✅</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-cyan-400" />
                    <span>رفع وصل التحويل (Payment Proof)</span>
                  </>
                )}
              </label>
            </div>

            {selectedMethod && (
              <div className="bg-white/5 p-4 rounded-2xl text-sm border border-white/10">
                <p className="text-cyan-400 font-bold mb-2">Payment Details:</p>
                {selectedMethod.accountName && <p>Name: {selectedMethod.accountName}</p>}
                {selectedMethod.rib && <p className="font-mono">RIB: {selectedMethod.rib}</p>}
                {selectedMethod.walletAddress && <p className="break-all font-mono">Address: {selectedMethod.walletAddress}</p>}
              </div>
            )}

            <TextArea placeholder="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
            <PrimaryButton onClick={submit} disabled={saving || uploading || !form.admin_method_id}>
              {saving ? "Sending..." : "Send Request"}
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* الـ History */}
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