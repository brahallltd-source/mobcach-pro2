"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";

type User = { role: string; email: string; agentId?: string };
type Wallet = { balance: number };
type AdminMethod = { id: string; type: string; method_name: string; currency: string; account_name?: string; rib?: string; wallet_address?: string; network?: string; phone?: string; fee_percent?: number };
type TopupRequest = { id: string; amount: number; admin_method_name: string; tx_hash?: string; proof_url?: string; status: string; created_at: string; note?: string; pendingBonusApplied?: number; bonus_amount?: number; gosport365_username?: string };

export default function AgentRechargePage() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [methods, setMethods] = useState<AdminMethod[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  // ✅ تم تحديث الـ Form ليشمل حقول اليوزر نيم
  const [form, setForm] = useState({ 
    amount: "1000", 
    admin_method_id: "", 
    proof_url: "", 
    proof_hash: "", 
    tx_hash: "", 
    note: "",
    gosport365_username: "",
    confirm_gosport365_username: ""
  });

  const load = async (agentId: string) => {
    const [walletRes, methodsRes, requestsRes] = await Promise.all([
      fetch(`/api/agent/wallet?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/admin/payment-methods-public`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/agent/topup-requests?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setWallet(walletRes.wallet || null);
    setMethods(methodsRes.methods || []);
    setRequests((requestsRes.requests || []).sort((a: TopupRequest, b: TopupRequest) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    if (!form.admin_method_id && (methodsRes.methods || [])[0]) setForm((prev) => ({ ...prev, admin_method_id: methodsRes.methods[0].id }));
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);
    if (current.agentId) load(current.agentId).finally(() => setLoading(false)); else setLoading(false);
  }, []);

  const selectedMethod = methods.find((item) => item.id === form.admin_method_id);
  const approvedCount = useMemo(() => requests.filter((item) => item.status === "approved").length, [requests]);
  const pendingCount = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests]);

  // ✅ منطق التحقق من صحة البيانات قبل الإرسال
  const isFormInvalid = useMemo(() => {
    if (!form.amount || Number(form.amount) <= 0) return true;
    if (!form.gosport365_username) return true;
    if (form.gosport365_username !== form.confirm_gosport365_username) return true;
    const requiresManualProof = selectedMethod?.type !== "crypto";
    if (requiresManualProof && !proofFile) return true;
    return false;
  }, [form, selectedMethod, proofFile]);

  const uploadProof = async () => {
    if (!proofFile || !user?.email) return null;
    const body = new FormData();
    body.append("file", proofFile);
    body.append("actorEmail", user.email);
    body.append("context", "agent_topup");
    const res = await fetch("/api/upload-transaction-proof", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to upload proof");
      return null;
    }
    setForm((prev) => ({ ...prev, proof_url: data.proof.url, proof_hash: data.proof.hash }));
    return data.proof;
  };

  const submit = async () => {
    if (!user?.agentId) return;
    if (isFormInvalid) return alert("Please check your usernames and proof");

    setSaving(true);
    const requiresManualProof = selectedMethod?.type !== "crypto";
    const proof = requiresManualProof ? await uploadProof() : { url: "", hash: "", duplicate_detected: false, suspicious_flags: [] };
    
    if (requiresManualProof && !proof) {
      setSaving(false);
      return;
    }

    const res = await fetch("/api/agent/topup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: user.agentId,
        agentEmail: user.email,
        amount: Number(form.amount),
        admin_method_id: selectedMethod?.id,
        admin_method_name: selectedMethod?.method_name,
        tx_hash: "",
        proof_url: proof?.url || "",
        proof_hash: proof?.hash || "",
        note: form.note,
        gosport365_username: form.gosport365_username, // ✅ إرسال اليوزر نيم
      }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to send recharge request");
      setSaving(false);
      return;
    }

    setForm((prev) => ({ ...prev, amount: "1000", proof_url: "", proof_hash: "", tx_hash: "", note: "", gosport365_username: "", confirm_gosport365_username: "" }));
    setProofFile(null);
    await load(user.agentId);
    setSaving(false);
    alert(data.message || "Recharge request sent");
  };

  if (loading || !user) return <SidebarShell role="agent"><LoadingCard text="Loading wallet recharge..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="شحن رصيد الوكيل"
        subtitle="أنشئ طلب شحن، ارفع صورة التحويل، وسيقوم المسؤول بمراجعته وتفعيل البونص تلقائياً."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="رصيد المحفظة" value={`${wallet?.balance || 0} DH`} hint="Usable balance" />
        <StatCard label="طرق الدفع" value={String(methods.length)} hint="Available methods" />
        <StatCard label="طلبات معلقة" value={String(pendingCount)} hint="Pending review" />
        <StatCard label="طلبات مقبولة" value={String(approvedCount)} hint="Processed" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">إنشاء طلب شحن</h2>
          <div className="mt-5 space-y-4">
            
            {/* ✅ حقول اليوزر نيم الجديدة */}
            <div className="grid gap-4 md:grid-cols-2">
              <TextField 
                value={form.gosport365_username} 
                onChange={(e) => setForm((prev) => ({ ...prev, gosport365_username: e.target.value }))} 
                placeholder="GoSport365 Username" 
              />
              <TextField 
                value={form.confirm_gosport365_username} 
                onChange={(e) => setForm((prev) => ({ ...prev, confirm_gosport365_username: e.target.value }))} 
                placeholder="Confirm Username" 
              />
            </div>
            
            {form.confirm_gosport365_username && form.gosport365_username !== form.confirm_gosport365_username && (
              <p className="text-xs font-medium text-red-400">⚠️ أسماء المستخدمين غير متطابقة</p>
            )}

            <TextField type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Amount (DH)" />
            
            <SelectField value={form.admin_method_id} onChange={(e) => setForm((prev) => ({ ...prev, admin_method_id: e.target.value }))}>
              {methods.map((item) => <option key={item.id} value={item.id}>{item.method_name} • {item.currency}</option>)}
            </SelectField>

            {selectedMethod && (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.22em] text-white/35 font-bold mb-3">بيانات التحويل</p>
                <div className="grid gap-2">
                  <p>الطريقة: <span className="font-semibold text-white">{selectedMethod.method_name}</span></p>
                  {selectedMethod.account_name && <p>الاسم: <span className="font-semibold text-white">{selectedMethod.account_name}</span></p>}
                  {selectedMethod.rib && <p>RIB: <span className="font-semibold text-cyan-300 font-mono">{selectedMethod.rib}</span></p>}
                  {selectedMethod.wallet_address && <p>Address: <span className="break-all font-semibold text-white">{selectedMethod.wallet_address}</span></p>}
                  {selectedMethod.phone && <p>الهاتف: <span className="font-semibold text-white">{selectedMethod.phone}</span></p>}
                </div>
              </div>
            )}

            {selectedMethod?.type !== "crypto" && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white/85">رفع وصل التحويل (Proof)</p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-white/75 transition hover:bg-white/10">
                  <ImagePlus size={16} />
                  {proofFile ? proofFile.name : "إختر صورة الوصل"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}

            <TextArea rows={3} value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="ملاحظة اختيارية للآدمن" />

            <PrimaryButton onClick={submit} disabled={saving || isFormInvalid} className="w-full">
              {saving ? "جاري الإرسال..." : "إرسال طلب الشحن"}
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* سجل الطلبات */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">سجل طلباتك</h2>
          <div className="mt-5 space-y-4">
            {requests.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">{item.amount} DH</p>
                    <p className="mt-1 text-xs text-white/40">{item.admin_method_name} • {new Date(item.created_at).toLocaleDateString()}</p>
                    {item.gosport365_username && <p className="mt-2 text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Account: {item.gosport365_username}</p>}
                    {item.bonus_amount ? <p className="mt-2 text-[11px] text-emerald-400 font-bold">+ {item.bonus_amount} DH Bonus</p> : null}
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                    item.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
            {!requests.length && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-white/30 italic">لا توجد طلبات سابقة</div>}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}