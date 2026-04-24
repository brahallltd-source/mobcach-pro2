"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseAgentRechargeForm } from "@/lib/validations/agent-recharge-request";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";
import { ImageUploader } from "@/components/ImageUploader";
import { toast } from "react-hot-toast";
import type { Lang } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

/**
 * Props the Server Component parent may pass to `RechargeForm`.
 * Must stay JSON-serializable (string, number, boolean, null, or nested plain objects/arrays of those).
 * Do not add functions, classes, `Date`, `Map`, `Set`, or symbols — Next.js cannot pass them from RSC to client.
 */
export type RechargeFormProps = {
  /** Optional override for treasury / admin top-up page copy. */
  pageTitle?: string;
  pageSubtitle?: string;
  /** When true, omits the GS365 branding strip above the title (e.g. recharge-from-admin). */
  hidePageHeaderBranding?: boolean;
};

const RECHARGE_MIN_AMOUNT = 1000;
/** Display-only hint for crypto treasury top-up (1 USDT → MAD). */
const USDT_TO_MAD_RATE = 10.5;

function formatRechargeDh(value: number, lang: Lang): string {
  const locale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US";
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${n} DH`;
}

function rechargeAmountMeetsMinimum(raw: string): boolean {
  const n = parseFloat(String(raw).trim());
  return Number.isFinite(n) && n >= RECHARGE_MIN_AMOUNT;
}

type FieldErrors = {
  amount?: string;
  method?: string;
  proof?: string;
  transaction_hash?: string;
  gosport365_username?: string;
  confirm_gosport365_username?: string;
};

function isTreasuryCryptoMethod(m: {
  type?: string;
  methodName?: string;
  method_name?: string;
} | null): boolean {
  if (!m) return false;
  const t = String(m.type ?? "").trim().toLowerCase();
  if (t === "crypto") return true;
  const name = `${m.methodName ?? m.method_name ?? ""}`.toUpperCase();
  return name.includes("USDT");
}

export function RechargeForm(_props: RechargeFormProps = {}) {
  const { pageTitle, pageSubtitle, hidePageHeaderBranding } = _props;
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [methods, setMethods] = useState<any[]>([]);
  /** Platform recharge bonus % from SystemSettings (default 10). */
  const [rechargeBonusPct, setRechargeBonusPct] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    amount: "1000",
    admin_method_id: "",
    note: "",
    proof_url: "",
    transaction_hash: "",
    agentEmail: "",
    gosport365_username: "",
    confirm_gosport365_username: "",
  });

  const clearField = useCallback((key: keyof FieldErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const loadData = async () => {
    const user = await requireMobcashUserOnClient("agent");
    if (!user) {
      setLoading(false);
      return void redirectToLogin();
    }

    try {
      const u = user as {
        id: string;
        agentId?: string;
        agentProfile?: { id?: string } | null;
      };
      /** Prefer `Agent.id` (FK on `PaymentMethod.agentId`); fall back to legacy `agentId` or `User.id`. */
      const agentId =
        u.agentProfile?.id ?? u.agentId ?? u.id;
      const [mRes, rRes, ctxRes] = await Promise.all([
        fetch(
          `/api/agent/payment-methods?agentId=${encodeURIComponent(agentId)}&includeTreasury=1`,
          { credentials: "include", cache: "no-store" }
        ),
        fetch(`/api/agent/topup-requests?agentId=${encodeURIComponent(agentId)}`, {
          credentials: "include",
        }),
        fetch("/api/agent/system-context", { credentials: "include", cache: "no-store" }),
      ]);

      const mData = await mRes.json();
      await rRes.json();
      if (ctxRes.ok) {
        const ctx = await ctxRes.json();
        const p = Number(ctx.bonusPercentage);
        if (Number.isFinite(p) && p >= 0) setRechargeBonusPct(p);
      }

      const raw = Array.isArray(mData.methods) ? mData.methods : [];
      // Recharge is to global treasury only — hide the agent's own player-facing methods from this dropdown.
      const treasuryOnly = raw.filter(
        (m: { agentId?: string | null; owner_role?: string }) =>
          m.agentId == null ||
          String(m.owner_role ?? "").trim().toLowerCase() === "admin"
      );
      setMethods(treasuryOnly);
      setForm((prev) => ({ ...prev, agentEmail: user.email }));
    } catch {
      toast.error(t("error_loading_failed") || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // Intentionally once on mount; `t` is stable for this load toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === form.admin_method_id),
    [methods, form.admin_method_id],
  );
  const isCrypto = useMemo(() => isTreasuryCryptoMethod(selectedMethod ?? null), [selectedMethod]);

  const validate = useCallback((): boolean => {
    const parsed = parseAgentRechargeForm(
      {
        amount: form.amount,
        admin_method_id: form.admin_method_id,
        proof_url: form.proof_url,
        transaction_hash: form.transaction_hash,
        gosport365_username: form.gosport365_username,
        confirm_gosport365_username: form.confirm_gosport365_username,
      },
      { isCrypto, minAmount: RECHARGE_MIN_AMOUNT },
    );
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "amount") next.amount = issue.message;
      else if (key === "admin_method_id") next.method = issue.message;
      else if (key === "proof_url") next.proof = issue.message;
      else if (key === "transaction_hash") next.transaction_hash = issue.message;
      else if (key === "gosport365_username") next.gosport365_username = issue.message;
      else if (key === "confirm_gosport365_username")
        next.confirm_gosport365_username = issue.message;
    }
    setErrors(next);
    return false;
  }, [
    form.amount,
    form.admin_method_id,
    form.proof_url,
    form.transaction_hash,
    form.gosport365_username,
    form.confirm_gosport365_username,
    isCrypto,
  ]);

  const canSubmit = useMemo(() => {
    return (
      parseAgentRechargeForm(
        {
          amount: form.amount,
          admin_method_id: form.admin_method_id,
          proof_url: form.proof_url,
          transaction_hash: form.transaction_hash,
          gosport365_username: form.gosport365_username,
          confirm_gosport365_username: form.confirm_gosport365_username,
        },
        { isCrypto, minAmount: RECHARGE_MIN_AMOUNT },
      ).success && !saving
    );
  }, [
    form.amount,
    form.admin_method_id,
    form.proof_url,
    form.transaction_hash,
    form.gosport365_username,
    form.confirm_gosport365_username,
    isCrypto,
    saving,
  ]);

  const rechargeBonusRate =
    Number.isFinite(rechargeBonusPct) && rechargeBonusPct >= 0 ? rechargeBonusPct / 100 : 0.1;

  const rechargeAmountBreakdown = useMemo(() => {
    const base = parseFloat(String(form.amount).trim());
    if (!Number.isFinite(base) || base <= 0) return null;
    const bonus = base * rechargeBonusRate;
    const total = base + bonus;
    return { base, bonus, total };
  }, [form.amount, rechargeBonusRate]);

  const submit = async () => {
    if (!validate()) {
      toast.error(t("recharge_fill_all_fields") || "Please fix the highlighted fields");
      return;
    }

    const u = await requireMobcashUserOnClient("agent");
    if (!u) return void redirectToLogin();

    setSaving(true);
    setErrors({});
    try {
      const methodRow = methods.find((m) => m.id === form.admin_method_id);
      const crypto = isTreasuryCryptoMethod(methodRow ?? null);
      const baseAmount = parseFloat(String(form.amount).trim());
      const bonusAmount = baseAmount * rechargeBonusRate;
      const totalWithBonus = baseAmount + bonusAmount;
      const proofTrim = String(form.proof_url || "").trim();
      const txTrim = String(form.transaction_hash || "").trim();
      const payload: Record<string, unknown> = {
        amount: baseAmount,
        bonusAmount,
        total_with_bonus: totalWithBonus,
        proofUrl: proofTrim || null,
        transactionHash: crypto ? (txTrim || undefined) : undefined,
        admin_method_id: form.admin_method_id,
        note: form.note,
        admin_method_name: methodRow?.method_name,
        gosport365_username: String(form.gosport365_username || "").trim(),
        confirm_gosport365_username: String(
          form.confirm_gosport365_username || ""
        ).trim(),
      };

      if (!crypto && !proofTrim) {
        toast.error(t("recharge_validation_proof") || "Proof URL required");
        return;
      }

      const res = await fetch("/api/agent/recharge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.request?.id) {
          console.log("Recharge request created:", data.request.id, data.request);
        }
        toast.success(data.message || t("recharge_request_sent") || "Request sent successfully");
        setForm((prev) => ({
          ...prev,
          amount: "1000",
          admin_method_id: "",
          note: "",
          proof_url: "",
          transaction_hash: "",
          gosport365_username: "",
          confirm_gosport365_username: "",
        }));
        void loadData();
        router.push("/agent/recharge/history");
      } else {
        const msg = String(data.message || t("error_failed_to_send") || "");
        const low = msg.toLowerCase();
        if (low.includes("total_with_bonus")) {
          setErrors((e) => ({ ...e, amount: msg }));
        } else if (low.includes("amount")) {
          setErrors((e) => ({
            ...e,
            amount:
              low.includes("minimum") || msg.includes("1000")
                ? t("recharge_validation_amount_minimum") || msg
                : msg,
          }));
        } else if (low.includes("proofurl") || low.includes("proof")) {
          setErrors((e) => ({ ...e, proof: msg }));
        } else if (msg.toLowerCase().includes("admin_method")) {
          setErrors((e) => ({ ...e, method: msg }));
        } else if (msg.toLowerCase().includes("gosport365_username")) {
          if (msg.toLowerCase().includes("match")) {
            setErrors((e) => ({ ...e, confirm_gosport365_username: msg }));
          } else {
            setErrors((e) => ({ ...e, gosport365_username: msg }));
          }
        }
        toast.error(msg);
      }
    } catch {
      toast.error(t("error_network_error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingCard text={t("loading") || "Loading..."} />;

  const requiredUsdt =
    isCrypto && rechargeAmountBreakdown
      ? (rechargeAmountBreakdown.total / USDT_TO_MAD_RATE).toFixed(2)
      : null;

  return (
    <SidebarShell role="agent">
      <PageHeader
        hideBranding={Boolean(hidePageHeaderBranding)}
        title={pageTitle || t("recharge_title") || "Recharge Account"}
        subtitle={pageSubtitle || t("recharge_subtitle") || "Add balance"}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" dir="rtl">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                {t("recharge_amount_label") || "Amount (DH)"}
              </label>
              <TextField
                type="number"
                inputMode="decimal"
                min={RECHARGE_MIN_AMOUNT}
                step="any"
                value={form.amount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setForm((prev) => ({ ...prev, amount: e.target.value }));
                  clearField("amount");
                }}
                className={errors.amount ? "ring-1 ring-rose-500/60" : undefined}
              />
              <p className="text-xs text-white/45">{t("recharge_amount_hint")}</p>
              {rechargeAmountBreakdown ? (
                <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm">
                  <p className="text-white/85">
                    <span className="text-white/55">Requested: </span>
                    <span className="font-semibold tabular-nums text-white" dir="ltr">
                      {formatRechargeDh(rechargeAmountBreakdown.base, lang)}
                    </span>
                  </p>
                  <p className="text-white/85">
                    <span className="text-white/55">Bonus ({rechargeBonusPct}%): </span>
                    <span className="font-semibold tabular-nums text-white" dir="ltr">
                      {formatRechargeDh(rechargeAmountBreakdown.bonus, lang)}
                    </span>
                  </p>
                  <p className="text-white/95">
                    <span className="font-medium text-white/70">Total to be Credited: </span>
                    <span
                      className="font-semibold text-emerald-300/95 tabular-nums"
                      dir="ltr"
                    >
                      {formatRechargeDh(rechargeAmountBreakdown.total, lang)}
                    </span>
                  </p>
                  {isCrypto ? (
                    <div className="space-y-1 border-t border-white/10 pt-3">
                      <p className="font-semibold text-amber-200/95" dir="ltr">
                        You must send: {requiredUsdt} USDT
                      </p>
                      <p className="text-xs text-white/45" dir="ltr">
                        (Exchange rate: 1 USDT = {USDT_TO_MAD_RATE} MAD)
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {errors.amount ? (
                <p className="text-sm text-rose-300" role="alert">
                  {errors.amount}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                {t("recharge_method_label") || "Payment Method"}
              </label>
              <SelectField
                value={form.admin_method_id}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setForm((prev) => ({
                    ...prev,
                    admin_method_id: e.target.value,
                    proof_url: "",
                    transaction_hash: "",
                  }));
                  clearField("method");
                  clearField("proof");
                  clearField("transaction_hash");
                }}
                className={errors.method ? "ring-1 ring-rose-500/60" : undefined}
              >
                <option value="">{t("recharge_method_placeholder")}</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.method_name, m.type, m.currency].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </SelectField>
              {errors.method ? (
                <p className="text-sm text-rose-300" role="alert">
                  {errors.method}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                {t("recharge_gosport365_username_label") || "GoSport365 username"}
              </label>
              <TextField
                type="text"
                autoComplete="username"
                value={form.gosport365_username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setForm((prev) => ({ ...prev, gosport365_username: e.target.value }));
                  clearField("gosport365_username");
                }}
                className={
                  errors.gosport365_username ? "ring-1 ring-rose-500/60" : undefined
                }
              />
              <p className="text-xs text-white/45">{t("recharge_gosport365_username_hint")}</p>
              {errors.gosport365_username ? (
                <p className="text-sm text-rose-300" role="alert">
                  {errors.gosport365_username}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                {t("recharge_confirm_gosport365_username_label") ||
                  "Confirm GoSport365 username"}
              </label>
              <TextField
                type="text"
                autoComplete="off"
                value={form.confirm_gosport365_username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setForm((prev) => ({
                    ...prev,
                    confirm_gosport365_username: e.target.value,
                  }));
                  clearField("confirm_gosport365_username");
                }}
                className={
                  errors.confirm_gosport365_username
                    ? "ring-1 ring-rose-500/60"
                    : undefined
                }
              />
              {errors.confirm_gosport365_username ? (
                <p className="text-sm text-rose-300" role="alert">
                  {errors.confirm_gosport365_username}
                </p>
              ) : null}
            </div>

            {isCrypto ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">
                  Transaction Hash (TxHash)
                </label>
                <TextField
                  type="text"
                  autoComplete="off"
                  placeholder="Transaction Hash (TxHash)"
                  value={form.transaction_hash}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setForm((prev) => ({ ...prev, transaction_hash: e.target.value }));
                    clearField("transaction_hash");
                  }}
                  className={errors.transaction_hash ? "ring-1 ring-rose-500/60" : undefined}
                />
                <p className="text-xs text-white/40">(اختياري - Optional)</p>
                {errors.transaction_hash ? (
                  <p className="text-sm text-rose-300" role="alert">
                    {errors.transaction_hash}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">
                  {t("recharge_proof_label") || "Payment Proof"}
                </label>
                <ImageUploader
                  value={form.proof_url}
                  onChange={(url) => {
                    clearField("proof");
                    const proof_url = String(url || "").trim();
                    setForm((prev) => ({ ...prev, proof_url }));
                  }}
                  selectButtonLabel={
                    t("recharge_select_receipt_image") || "Select Receipt Image"
                  }
                />
                <p className="text-xs text-white/45">{t("recharge_upload_hint")}</p>
                {errors.proof ? (
                  <p className="text-sm text-rose-300" role="alert">
                    {errors.proof}
                  </p>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                {t("recharge_note_label") || "Note"}
              </label>
              <TextArea
                value={form.note}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                rows={3}
              />
            </div>

            <PrimaryButton
              type="button"
              onClick={submit}
              disabled={saving || !canSubmit}
              className="inline-flex w-full items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  <span>Loading...</span>
                </>
              ) : (
                t("recharge_submit_btn")
              )}
            </PrimaryButton>
            {!canSubmit && !saving ? (
              <p className="text-center text-xs text-white/40">{t("recharge_submit_disabled_hint")}</p>
            ) : null}
          </div>
        </GlassCard>

        <div className="space-y-6">
          {selectedMethod ? (
            <GlassCard className="border-emerald-500/20 bg-emerald-500/5 p-6">
              <h3 className="mb-4 border-b border-emerald-500/20 pb-2 text-right font-bold text-emerald-400">
                {t("recharge_payment_details")}
              </h3>
              <div className="space-y-4 text-sm text-white/90">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">{t("accountName")}:</span>
                  <span className="font-bold">{selectedMethod.account_name}</span>
                </div>
                {selectedMethod.rib && (
                  <div className="space-y-1 text-left" dir="ltr">
                    <span className="block text-right text-white/40">
                      {t("accountNumber")}:
                    </span>
                    <span className="block select-all rounded bg-black/30 p-2 text-center font-mono">
                      {selectedMethod.rib}
                    </span>
                  </div>
                )}
                {selectedMethod.wallet_address && (
                  <div className="space-y-1 text-left" dir="ltr">
                    <span className="block text-right text-white/40">
                      {t("walletAddress")}:
                    </span>
                    <span className="block break-all select-all rounded bg-black/30 p-2 text-center text-xs font-mono">
                      {selectedMethod.wallet_address}
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <p className="text-center text-sm italic text-white/40">
                {t("recharge_select_method_hint")}
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </SidebarShell>
  );
}
