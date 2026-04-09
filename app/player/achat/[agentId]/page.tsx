"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Copy, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/language";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, TextArea, TextField } from "@/components/ui";

type CurrentUser = { id: string; email: string; role: string; player_status?: "inactive" | "active"; assigned_agent_id?: string };
type Method = {
  id: string;
  method_name: string;
  currency: string;
  type: string;
  account_name?: string;
  account_number?: string;
  rib?: string;
  wallet_address?: string;
  instructions?: string;
  phone?: string;
  network?: string;
  provider?: string;
  city?: string;
  fee_percent?: number;
};
type AgentRow = { 
  agentId: string; 
  display_name: string; 
  online: boolean; 
  rating: number; 
  trades_count: number; 
  response_minutes: number; 
  min_limit: number; 
  max_limit: number; 
  available_balance: number; // تم إضافتها للتحقق
  methods: Method[] 
};

export default function AchatAgentPage() {
  const { t } = useLanguage();
  const params = useParams<{ agentId: string }>();
  const search = useSearchParams();
  
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // تم إزالة proofFile لأن الرفع سيتم في الصفحة التالية

  const [form, setForm] = useState({
    amount: search.get("amount") || "",
    gosport365_username: "",
    confirm_gosport365_username: "",
    notes: "",
    payment_method_id: search.get("methodId") || "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    if (!current.assigned_agent_id) return void (window.location.href = "/player/select-agent");
    if (String(current.assigned_agent_id) !== String(params.agentId)) return void (window.location.href = "/player/achat");
    setUser(current);

    Promise.all([
      fetch("/api/agents/discovery", { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/agent/payment-methods?agentId=${encodeURIComponent(String(params.agentId))}`, { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([agentsData, methodsData]) => {
        setAgent((agentsData.agents || []).find((item: AgentRow) => item.agentId === String(params.agentId)) || null);
        setMethods(methodsData.methods || []);
      })
      .finally(() => setLoading(false));
  }, [params.agentId]);

  const selectedMethod = useMemo(
    () => methods.find((item) => item.id === form.payment_method_id) || methods[0] || null,
    [methods, form.payment_method_id]
  );

  useEffect(() => {
    if (!form.payment_method_id && methods[0]) {
      setForm((prev) => ({ ...prev, payment_method_id: methods[0].id }));
    }
  }, [methods, form.payment_method_id]);

  const numericAmount = Number(form.amount || 0);

  // التحقق الأمني من الرصيد والحدود لحماية اللاعب
  const limitError = useMemo(() => {
    if (!agent || !numericAmount) return "";
    if (agent.min_limit && numericAmount < agent.min_limit) {
      return `Minimum amount is ${agent.min_limit} DH`;
    }
    if (agent.max_limit && numericAmount > agent.max_limit) {
      return `Maximum amount is ${agent.max_limit} DH`;
    }
    if (agent.available_balance !== undefined && numericAmount > agent.available_balance) {
      return `Amount exceeds agent's available balance (${agent.available_balance} DH)`;
    }
    return "";
  }, [agent, numericAmount]);

  const copyValue = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    alert("Copied successfully");
  };

  const createOrder = async () => {
    if (!user || !agent || !selectedMethod) return;
    
    if (!form.amount || !form.gosport365_username || !form.confirm_gosport365_username) {
      return alert("Amount and username confirmation are required");
    }
    if (form.gosport365_username.trim() !== form.confirm_gosport365_username.trim()) {
      return alert("GoSport 365 username confirmation does not match");
    }
    if (limitError) {
      return alert(limitError);
    }
    if (user.player_status !== "active") return alert(t("accountPending"));
    
    setSubmitting(true);
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail: user.email,
          agentId: agent.agentId,
          gosport365_username: form.gosport365_username,
          amount: Number(form.amount),
          payment_method_id: selectedMethod.id,
          payment_method_name: selectedMethod.method_name,
          currency: selectedMethod.currency,
          notes: form.notes,
          proof_url: "", // نتركه فارغاً هنا (لا يوجد إثبات في هذه المرحلة)
          proof_hash: "",
          duplicate_detected: false,
          suspicious_flags: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Failed to create order");
      
      // توجيه اللاعب مباشرة لصفحة الطلب ليقوم بالتحويل ورفع الإثبات هناك
      const newOrderId = data.orderId || data.order?.id;
      if (newOrderId) {
        window.location.href = `/player/orders/${newOrderId}`;
      } else {
        window.location.href = "/player/orders";
      }
    } catch (error: any) {
      alert(error.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="Loading order flow..." /></SidebarShell>;
  if (!agent || !selectedMethod) return <SidebarShell role="player"><GlassCard className="p-10 text-center">Agent or payment methods not available.</GlassCard></SidebarShell>;

  return (
    <SidebarShell role="player">
      <div className="pb-36 lg:pb-8">
        <PageHeader
          title="New order request"
          subtitle="Choose your payment method and enter the amount. You will upload the proof on the next page."
        />

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-5 md:p-7">
            <h2 className="text-2xl font-semibold">Select your method</h2>
            <div className="mt-5 space-y-3">
              {methods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setForm((prev) => ({ ...prev, payment_method_id: method.id }))}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    selectedMethod.id === method.id
                      ? "border-cyan-300/30 bg-cyan-300/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{method.method_name}</p>
                      <p className="mt-1 text-sm text-white/55">{method.type} • {method.currency}</p>
                    </div>
                    <ShieldCheck size={18} className="text-cyan-200" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/65">
              <p className="font-semibold text-white/85">Transfer instructions</p>
              <p className="text-xs text-white/40 mb-3">Please do not transfer money until you create the order.</p>
              <div className="mt-4 grid gap-3 opacity-60">
                {/* تم تخفيف الشفافية قليلاً هنا لإشعار اللاعب بأن هذه البيانات للعرض فقط وأن التحويل سيكون في الصفحة التالية */}
                {selectedMethod.account_name ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <span>Account name: <span className="font-semibold text-white">{selectedMethod.account_name}</span></span>
                    <button onClick={() => copyValue(selectedMethod.account_name)} className="text-cyan-200"><Copy size={15} /></button>
                  </div>
                ) : null}
                {selectedMethod.rib ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <span>RIB: <span className="font-semibold text-white">{selectedMethod.rib}</span></span>
                    <button onClick={() => copyValue(selectedMethod.rib)} className="text-cyan-200"><Copy size={15} /></button>
                  </div>
                ) : null}
                {selectedMethod.wallet_address ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <span className="min-w-0 flex-1 break-all">Wallet: <span className="font-semibold text-white">{selectedMethod.wallet_address}</span></span>
                    <button onClick={() => copyValue(selectedMethod.wallet_address)} className="shrink-0 text-cyan-200"><Copy size={15} /></button>
                  </div>
                ) : null}
                {selectedMethod.phone ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <span>Phone: <span className="font-semibold text-white">{selectedMethod.phone}</span></span>
                    <button onClick={() => copyValue(selectedMethod.phone)} className="text-cyan-200"><Copy size={15} /></button>
                  </div>
                ) : null}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-7">
            <h2 className="text-2xl font-semibold">Create your order</h2>
            <div className="mt-5 grid gap-4">
              
              {/* عرض الحدود بوضوح لللاعب */}
              <div className="grid gap-3 md:grid-cols-3 mb-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60 text-center">
                  Min: <span className="font-semibold text-white block">{agent.min_limit} DH</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60 text-center">
                  Max: <span className="font-semibold text-white block">{agent.max_limit} DH</span>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 text-center">
                  Available: <span className="font-semibold text-emerald-100 block">{agent.available_balance} DH</span>
                </div>
              </div>

              <TextField type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder={t("enterAmount")} />
              
              {limitError ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {limitError}
                </div>
              ) : null}

              <TextField value={form.gosport365_username} onChange={(e) => setForm((prev) => ({ ...prev, gosport365_username: e.target.value }))} placeholder={t("gosportUsername")} />
              <TextField value={form.confirm_gosport365_username} onChange={(e) => setForm((prev) => ({ ...prev, confirm_gosport365_username: e.target.value }))} placeholder={t("confirmGosportUsername")} />
              
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200 text-center">
                Clicking "Send Order" will take you to the payment page to upload your transfer receipt safely.
              </div>

              <TextArea rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t("notesOptional")} />
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[84px] z-30 px-3 lg:static lg:bottom-auto lg:px-0">
        <div className="mx-auto max-w-3xl lg:max-w-7xl">
          <GlassCard className="p-3 shadow-2xl">
            <PrimaryButton onClick={createOrder} disabled={submitting || Boolean(limitError) || !form.amount} className="w-full py-4 text-base">
              {submitting ? t("processing") : "Send Order"}
            </PrimaryButton>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}