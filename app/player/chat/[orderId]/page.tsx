"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Copy, ImagePlus, ShieldCheck, Clock3, Star, WalletCards } from "lucide-react";
import { useLanguage } from "@/components/language";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";

type CurrentUser = {
  id: string;
  email: string;
  role: string;
  player_status?: "inactive" | "active";
  assigned_agent_id?: string;
};

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
  available_balance: number;
  methods: Method[];
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
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    amount: search.get("amount") || "",
    gosport365_username: "",
    confirm_gosport365_username: "",
    notes: "",
    payment_method_id: search.get("methodId") || "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) {
      window.location.href = "/login";
      return;
    }

    const current = JSON.parse(saved);

    if (current.role !== "player") {
      window.location.href = "/login";
      return;
    }

    if (!current.assigned_agent_id) {
      window.location.href = "/player/select-agent";
      return;
    }

    if (String(current.assigned_agent_id) !== String(params.agentId)) {
      window.location.href = "/player/achat";
      return;
    }

    setUser(current);

    const load = async () => {
      try {
        const [agentsData, methodsData] = await Promise.all([
          fetch("/api/agents/discovery", { cache: "no-store" }).then((res) => res.json()),
          fetch(`/api/agent/payment-methods?agentId=${encodeURIComponent(String(params.agentId))}`, {
            cache: "no-store",
          }).then((res) => res.json()),
        ]);

        setAgent(
          (agentsData.agents || []).find(
            (item: AgentRow) => item.agentId === String(params.agentId)
          ) || null
        );
        setMethods(methodsData.methods || []);
      } catch (error) {
        console.error("LOAD ACHAT PAGE ERROR:", error);
      } finally {
        setLoading(false);
      }
    };

    void load();
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

  const limitError = useMemo(() => {
    if (!agent || !numericAmount) return "";

    if (agent.min_limit && numericAmount < agent.min_limit) {
      return `Minimum amount is ${agent.min_limit} DH`;
    }

    if (agent.max_limit && numericAmount > agent.max_limit) {
      return `Maximum amount is ${agent.max_limit} DH`;
    }

    if (agent.available_balance && numericAmount > agent.available_balance) {
      return `This amount is not available with the selected agent`;
    }

    return "";
  }, [agent, numericAmount]);

  const copyValue = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    alert("Copied successfully");
  };

  const uploadProof = async () => {
    if (!proofFile || !user) return null;

    const body = new FormData();
    body.append("file", proofFile);
    body.append("playerEmail", user.email);

    const res = await fetch("/api/upload-proof", { method: "POST", body });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Failed to upload proof");
    return data.proof;
  };

  const createOrder = async () => {
    if (!user || !agent || !selectedMethod) return;

    const requiresManualProof = selectedMethod.type !== "crypto";

    if (
      !form.amount ||
      !form.gosport365_username ||
      !form.confirm_gosport365_username ||
      (requiresManualProof && !proofFile)
    ) {
      alert(
        requiresManualProof
          ? "Amount, username confirmation and proof image are required"
          : "Amount and username confirmation are required"
      );
      return;
    }

    if (form.gosport365_username.trim() !== form.confirm_gosport365_username.trim()) {
      alert("GoSport 365 username confirmation does not match");
      return;
    }

    if (limitError) {
      alert(limitError);
      return;
    }

    if (user.player_status !== "active") {
      alert(t("accountPending"));
      return;
    }

    setSubmitting(true);

    try {
      const proof = requiresManualProof
        ? await uploadProof()
        : { url: "", hash: "", duplicate_detected: false, suspicious_flags: [] };

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
          proof_url: proof?.url || "",
          proof_hash: proof?.hash || "",
          duplicate_detected: proof?.duplicate_detected || false,
          suspicious_flags: proof?.suspicious_flags || [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to create order");
        return;
      }

      alert(data.message || "Order created");
      window.location.href = "/player/orders";
    } catch (error: any) {
      alert(error.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading order flow..." />
      </SidebarShell>
    );
  }

  if (!agent || !selectedMethod) {
    return (
      <SidebarShell role="player">
        <GlassCard className="p-10 text-center">
          Agent or payment methods not available.
        </GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="Buy with selected agent"
        subtitle="Review limits, choose your payment method and place your order with the assigned agent."
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Advertiser</p>
              <h2 className="mt-2 text-2xl font-semibold">{agent.display_name}</h2>
              <p className="mt-2 text-sm text-white/55">
                {agent.online ? "Online" : "Offline"}
              </p>
            </div>

            <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              Verified desk
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/55">
                <Star size={14} className="text-amber-300" />
                Rating
              </div>
              <p className="mt-2 text-xl font-semibold">{agent.rating}%</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/55">
                <WalletCards size={14} className="text-cyan-300" />
                Trades
              </div>
              <p className="mt-2 text-xl font-semibold">{agent.trades_count}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/55">
                <Clock3 size={14} className="text-cyan-300" />
                Avg. release
              </div>
              <p className="mt-2 text-xl font-semibold">{agent.response_minutes} min</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/55">
                <ShieldCheck size={14} className="text-emerald-300" />
                Available
              </div>
              <p className="mt-2 text-xl font-semibold">{agent.available_balance} DH</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Min</p>
              <p className="mt-2 text-xl font-semibold">{agent.min_limit} DH</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Max</p>
              <p className="mt-2 text-xl font-semibold">{agent.max_limit} DH</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Payment</p>
              <p className="mt-2 text-sm text-white/75">
                {methods.map((m) => m.method_name).join(" • ")}
              </p>
            </div>
          </div>

          <h3 className="mt-8 text-xl font-semibold">Payment method</h3>
          <div className="mt-4 space-y-3">
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() =>
                  setForm((prev) => ({ ...prev, payment_method_id: method.id }))
                }
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  selectedMethod.id === method.id
                    ? "border-cyan-300/30 bg-cyan-300/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{method.method_name}</p>
                    <p className="mt-1 text-sm text-white/55">
                      {method.type} • {method.currency}
                    </p>
                  </div>
                  <ShieldCheck size={18} className="text-cyan-200" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/65">
            <p className="font-semibold text-white/85">Payment details</p>
            <div className="mt-4 grid gap-3">
              {selectedMethod.account_name ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span>
                    Account name:{" "}
                    <span className="font-semibold text-white">
                      {selectedMethod.account_name}
                    </span>
                  </span>
                  <button
                    onClick={() => copyValue(selectedMethod.account_name)}
                    className="text-cyan-200"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              ) : null}

              {selectedMethod.rib ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span>
                    RIB: <span className="font-semibold text-white">{selectedMethod.rib}</span>
                  </span>
                  <button
                    onClick={() => copyValue(selectedMethod.rib)}
                    className="text-cyan-200"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              ) : null}

              {selectedMethod.wallet_address ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span className="min-w-0 flex-1 break-all">
                    Wallet:{" "}
                    <span className="font-semibold text-white">
                      {selectedMethod.wallet_address}
                    </span>
                  </span>
                  <button
                    onClick={() => copyValue(selectedMethod.wallet_address)}
                    className="shrink-0 text-cyan-200"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              ) : null}

              {selectedMethod.phone ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span>
                    Phone:{" "}
                    <span className="font-semibold text-white">{selectedMethod.phone}</span>
                  </span>
                  <button
                    onClick={() => copyValue(selectedMethod.phone)}
                    className="text-cyan-200"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              ) : null}

              {selectedMethod.network ? (
                <p>
                  Network:{" "}
                  <span className="font-semibold text-white">{selectedMethod.network}</span>
                </p>
              ) : null}

              {selectedMethod.provider ? (
                <p>
                  Provider:{" "}
                  <span className="font-semibold text-white">{selectedMethod.provider}</span>
                </p>
              ) : null}

              {selectedMethod.city ? (
                <p>
                  City: <span className="font-semibold text-white">{selectedMethod.city}</span>
                </p>
              ) : null}

              {selectedMethod.instructions ? (
                <p>
                  Instructions:{" "}
                  <span className="font-semibold text-white">
                    {selectedMethod.instructions}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 md:p-7">
          <h2 className="text-2xl font-semibold">Order details</h2>

          <div className="mt-5 grid gap-4">
            <TextField
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder={t("enterAmount")}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                Min: <span className="font-semibold text-white">{agent.min_limit} DH</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                Max: <span className="font-semibold text-white">{agent.max_limit} DH</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                Available:{" "}
                <span className="font-semibold text-white">{agent.available_balance} DH</span>
              </div>
            </div>

            {limitError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {limitError}
              </div>
            ) : null}

            <TextField
              value={form.gosport365_username}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, gosport365_username: e.target.value }))
              }
              placeholder={t("gosportUsername")}
            />

            <TextField
              value={form.confirm_gosport365_username}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  confirm_gosport365_username: e.target.value,
                }))
              }
              placeholder={t("confirmGosportUsername")}
            />

            {selectedMethod.type === "crypto" ? (
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-100">
                Crypto checkout does not require image proof.
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm font-medium text-white/75 transition hover:bg-white/5">
                <ImagePlus size={16} />
                {proofFile ? proofFile.name : t("uploadProof")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </label>
            )}

            <TextArea
              rows={5}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={t("notesOptional")}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Once the order is placed, it will appear in your order history. The agent will review
            your proof first, then you can confirm the recharge once it is delivered.
          </div>

          <PrimaryButton
            onClick={createOrder}
            disabled={submitting || Boolean(limitError)}
            className="mt-6 w-full py-4 text-base"
          >
            {submitting ? t("processing") : "Place Order"}
          </PrimaryButton>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}