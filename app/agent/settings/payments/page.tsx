"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  Building2,
  Clock,
  Landmark,
  Pencil,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  GlassCard,
  LoadingCard,
  NavPill,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  Switch,
  TextField,
} from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import {
  AGENT_EXECUTION_TIME_VALUES,
  AGENT_PAYMENT_CATALOG,
  AGENT_PAYMENT_CATALOG_LENGTH,
  type AgentPaymentCategory,
  agentPaymentSettingsSchema,
  defaultAgentPaymentSettings,
  validatePaymentMethodsCategorySlice,
  type AgentPaymentMethodRow,
  type AgentPaymentSettingsForm,
} from "@/lib/agent-payment-settings";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import {
  activeFieldKeysForMethod,
  CASHPLUS_FLOW_OPTIONS,
  PAYMENT_FIELD_LABEL_AR,
  paymentMethodTitle,
} from "@/lib/constants/payment-methods";
import type { PaymentMethodStoredFieldKey } from "@/lib/constants/payment-methods";

const CATEGORY_META: Record<
  AgentPaymentCategory,
  { title: string; subtitle: string; Icon: LucideIcon }
> = {
  bank: {
    title: "البنوك",
    subtitle: "CIH، Attijari، LbankaLIK، Banque Populaire، BMCE، CFG",
    Icon: Landmark,
  },
  cash: {
    title: "خدمات الكاش",
    subtitle: "Cash Plus، Jibi، Wafacash، Cash Express Auto",
    Icon: Banknote,
  },
  telecom: {
    title: "خدمات الاتصالات",
    subtitle: "MT Cash، Orange Money",
    Icon: Smartphone,
  },
  digital: {
    title: "المحافظ الرقمية",
    subtitle: "Daba Pay، WePay CIH",
    Icon: Wallet,
  },
};

const METHOD_ICONS: Record<string, LucideIcon> = {
  cih: Building2,
  attijari: Landmark,
  lbankalik: Building2,
  bank_populaire: Building2,
  bmce: Building2,
  cfg: Building2,
  cashplus: Banknote,
  jibi: Wallet,
  wafacash: Wallet,
  cash_express_auto: Banknote,
  mtcash: Smartphone,
  orange_money: Smartphone,
  daba_pay: Wallet,
  wepay_cih: Wallet,
};

function pmFieldMessage(
  errors: FieldErrors<AgentPaymentSettingsForm> | undefined,
  index: number,
  key: string
): string | undefined {
  const row = errors?.paymentMethods?.[index];
  if (!row || typeof row !== "object") return undefined;
  const cell = (row as Record<string, { message?: string } | undefined>)[key];
  return cell?.message;
}

async function postPaymentSettings(values: AgentPaymentSettingsForm): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/agent/settings/payments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, message: data.message || "فشل الحفظ" };
  }
  return { ok: true, message: data.message || "تم الحفظ" };
}

export default function AgentPaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [agentLabel, setAgentLabel] = useState("");
  const [activeTab, setActiveTab] = useState<AgentPaymentCategory>("bank");
  const [savingExecution, setSavingExecution] = useState(false);
  const [editingByMethodId, setEditingByMethodId] = useState<Record<string, boolean>>({});
  const [savingMethodId, setSavingMethodId] = useState<string | null>(null);

  const form = useForm<AgentPaymentSettingsForm>({
    resolver: zodResolver(agentPaymentSettingsSchema),
    defaultValues: defaultAgentPaymentSettings(),
    mode: "onSubmit",
  });

  const { control, handleSubmit, register, reset, formState, getValues, setError, clearErrors } = form;

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/settings/payments", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "load failed");
    reset({
      executionTime: data.executionTime,
      paymentMethods: data.paymentMethods,
    });
  }, [reset]);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      const mu = u as MobcashUser;
      const label =
        mu.agentProfile?.fullName?.trim() ||
        mu.agentProfile?.username?.trim() ||
        "الوكيل";
      setAgentLabel(label);
      try {
        await load();
      } catch {
        toast.error("تعذّر تحميل الإعدادات");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const executionTime = useWatch({ control, name: "executionTime" });
  const paymentMethodsWatch = useWatch({ control, name: "paymentMethods" });

  const activePreviewMethods = useMemo(() => {
    const list = paymentMethodsWatch ?? [];
    return list.filter((m) => m?.isActive);
  }, [paymentMethodsWatch]);

  const onSaveAll = handleSubmit(async (values) => {
    const r = await postPaymentSettings(values);
    if (!r.ok) {
      toast.error(r.message || "فشل الحفظ");
      return;
    }
    toast.success(r.message || "تم الحفظ");
    setEditingByMethodId({});
    try {
      await load();
    } catch {
      /* ignore */
    }
  });

  const allMethodIndices = useMemo(
    () => Array.from({ length: AGENT_PAYMENT_CATALOG_LENGTH }, (_, i) => i),
    []
  );

  const saveMethod = async (index: number, methodId: string) => {
    const values = getValues() as unknown as AgentPaymentSettingsForm;
    clearErrors("paymentMethods");
    const sliceCheck = validatePaymentMethodsCategorySlice(
      values.paymentMethods as AgentPaymentMethodRow[],
      allMethodIndices
    );
    if (sliceCheck.ok === false) {
      setError(
        `paymentMethods.${sliceCheck.firstIndex}.${sliceCheck.field}` as Parameters<typeof setError>[0],
        {
          type: "manual",
          message: sliceCheck.message,
        }
      );
      toast.error(sliceCheck.message);
      return;
    }
    const parsed = agentPaymentSettingsSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "بيانات غير صالحة");
      return;
    }
    setSavingMethodId(methodId);
    try {
      const r = await postPaymentSettings(parsed.data);
      if (!r.ok) {
        toast.error(r.message || "فشل الحفظ");
        return;
      }
      toast.success("تم حفظ إعدادات الدفع بنجاح");
      setEditingByMethodId((prev) => ({ ...prev, [methodId]: false }));
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setSavingMethodId(null);
    }
  };

  const saveExecutionOnly = async () => {
    const values = getValues() as unknown as AgentPaymentSettingsForm;
    const parsed = agentPaymentSettingsSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "تعذّر التحقق من البيانات");
      return;
    }
    setSavingExecution(true);
    try {
      const r = await postPaymentSettings(parsed.data);
      if (!r.ok) {
        toast.error(r.message || "فشل الحفظ");
        return;
      }
      toast.success(r.message || "تم حفظ وقت التنفيذ");
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setSavingExecution(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري تحميل إعدادات الدفع..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="وسائل الدفع وإعدادات الخدمة"
        subtitle="المصدر الوحيد لوسائل الدفع بين اللاعب والوكيل: فعّل الوسيلة، املأ الحقول المطلوبة، وحدّد الحد الأدنى والأقصى للإيداع (MAD) لكل وسيلة."
        action={
          <div className="flex flex-wrap gap-2">
            <NavPill href="/agent/settings/general" label="بيانات الوكيل" />
          </div>
        }
      />

      <form onSubmit={onSaveAll}>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <GlassCard className="border border-white/[0.06] p-6 shadow-lg shadow-black/20 md:p-8">
              <h2 className="text-lg font-semibold text-white">سرعة التنفيذ</h2>
              <p className="mt-1 text-sm text-white/55">
                الوقت الذي يُعرض للاعبين كتعهد تنفيذ (يظهر في المعاينة الحية وسوق اللاعبين).
              </p>
              <div className="mt-4 max-w-xs">
                <label className="mb-1 block text-xs text-white/50">المدة</label>
                <SelectField {...register("executionTime")}>
                  {AGENT_EXECUTION_TIME_VALUES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </SelectField>
              </div>
              <PrimaryButton
                type="button"
                className="mt-5 min-w-[180px]"
                disabled={savingExecution}
                onClick={() => void saveExecutionOnly()}
              >
                {savingExecution ? "جاري الحفظ..." : "حفظ وقت التنفيذ"}
              </PrimaryButton>
            </GlassCard>

            <GlassCard className="border border-white/[0.06] p-0 shadow-lg shadow-black/20">
              <div className="border-b border-white/10 px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold text-white">وسائل الدفع للاعبين</h2>
                <p className="mt-1 text-sm text-white/50">
                  كل وسيلة مفعّلة تتطلب الحقول الخاصة بها بالإضافة إلى حدّي الإيداع (الحد الأدنى &lt; الحد الأقصى).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 border-b border-white/10 bg-black/20 px-3 py-3 md:px-4">
                {(Object.keys(CATEGORY_META) as AgentPaymentCategory[]).map((key) => {
                  const { title, Icon } = CATEGORY_META[key];
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      {title}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 p-5 md:p-6">
                {(Object.keys(CATEGORY_META) as AgentPaymentCategory[]).map((cat) => {
                  if (cat !== activeTab) return null;
                  const meta = CATEGORY_META[cat];
                  const CatIcon = meta.Icon;
                  return (
                    <div key={cat} className="space-y-4">
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
                          <CatIcon className="h-5 w-5" aria-hidden />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{meta.title}</h3>
                          <p className="mt-1 text-xs text-white/45">{meta.subtitle}</p>
                        </div>
                      </div>

                      {AGENT_PAYMENT_CATALOG.filter((m) => m.category === cat).map((methodMeta) => {
                        const index = AGENT_PAYMENT_CATALOG.findIndex((x) => x.id === methodMeta.id);
                        const Icon = METHOD_ICONS[methodMeta.id] ?? Building2;
                        const active = Boolean(paymentMethodsWatch?.[index]?.isActive);
                        const isEditing = Boolean(editingByMethodId[methodMeta.id]);
                        const keys = activeFieldKeysForMethod(methodMeta.id);
                        const row = paymentMethodsWatch?.[index];
                        const minV = row?.min_amount ?? "—";
                        const maxV = row?.max_amount ?? "—";
                        return (
                          <div
                            key={methodMeta.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors duration-200 md:p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-cyan-300">
                                  <Icon size={20} strokeWidth={1.75} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-white">{methodMeta.name}</h4>
                                  {active ? (
                                    <p className="mt-1 text-xs leading-relaxed text-white/45">
                                      {methodMeta.instructionHint}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <Controller
                                control={control}
                                name={`paymentMethods.${index}.isActive`}
                                render={({ field }) => (
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={(v) => {
                                      field.onChange(v);
                                      setEditingByMethodId((prev) => ({
                                        ...prev,
                                        [methodMeta.id]: Boolean(v),
                                      }));
                                    }}
                                    aria-label={`تفعيل ${methodMeta.name}`}
                                  />
                                )}
                              />
                            </div>
                            <input type="hidden" {...register(`paymentMethods.${index}.id`)} />

                            {active && !isEditing ? (
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-100">
                                    مفعّل
                                  </span>
                                  <span className="text-sm text-muted-foreground" dir="ltr">
                                    Min: {minV} | Max: {maxV}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
                                  aria-label="تعديل"
                                  onClick={() =>
                                    setEditingByMethodId((prev) => ({ ...prev, [methodMeta.id]: true }))
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            ) : null}

                            {active ? (
                              <div
                                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                  isEditing ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                }`}
                              >
                                <div className="min-h-0 overflow-hidden">
                                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-white/55">
                                          {PAYMENT_FIELD_LABEL_AR.min_amount}
                                        </label>
                                        <TextField
                                          type="number"
                                          min={0}
                                          step={1}
                                          {...register(`paymentMethods.${index}.min_amount`, {
                                            valueAsNumber: true,
                                          })}
                                        />
                                        {pmFieldMessage(formState.errors, index, "min_amount") ? (
                                          <p className="mt-1 text-sm text-rose-300" role="alert">
                                            {pmFieldMessage(formState.errors, index, "min_amount")}
                                          </p>
                                        ) : null}
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-white/55">
                                          {PAYMENT_FIELD_LABEL_AR.max_amount}
                                        </label>
                                        <TextField
                                          type="number"
                                          min={0}
                                          step={1}
                                          {...register(`paymentMethods.${index}.max_amount`, {
                                            valueAsNumber: true,
                                          })}
                                        />
                                        {pmFieldMessage(formState.errors, index, "max_amount") ? (
                                          <p className="mt-1 text-sm text-rose-300" role="alert">
                                            {pmFieldMessage(formState.errors, index, "max_amount")}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>

                                    {keys.map((fieldKey) => {
                                      if (fieldKey === "cashplus_flow") {
                                        return (
                                          <div key={fieldKey}>
                                            <label className="mb-1 block text-xs font-medium text-white/55">
                                              {PAYMENT_FIELD_LABEL_AR.cashplus_flow}
                                            </label>
                                            <Controller
                                              control={control}
                                              name={`paymentMethods.${index}.cashplus_flow`}
                                              render={({ field }) => (
                                                <SelectField
                                                  value={field.value || ""}
                                                  onChange={(e) =>
                                                    field.onChange(
                                                      e.target.value as "envoi_mobile" | "conference" | ""
                                                    )
                                                  }
                                                >
                                                  <option value="">— اختر —</option>
                                                  {CASHPLUS_FLOW_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>
                                                      {o.label}
                                                    </option>
                                                  ))}
                                                </SelectField>
                                              )}
                                            />
                                            {pmFieldMessage(formState.errors, index, "cashplus_flow") ? (
                                              <p className="mt-1 text-sm text-rose-300" role="alert">
                                                {pmFieldMessage(formState.errors, index, "cashplus_flow")}
                                              </p>
                                            ) : null}
                                          </div>
                                        );
                                      }
                                      const label =
                                        PAYMENT_FIELD_LABEL_AR[fieldKey as PaymentMethodStoredFieldKey];
                                      if (fieldKey === "rib_24_digits") {
                                        return (
                                          <div key={fieldKey}>
                                            <label className="mb-1 block text-xs font-medium text-white/55">
                                              {label}
                                            </label>
                                            <TextField
                                              type="text"
                                              inputMode="numeric"
                                              autoComplete="off"
                                              maxLength={24}
                                              placeholder="007xxxx..."
                                              {...register(`paymentMethods.${index}.rib_24_digits`)}
                                            />
                                            {pmFieldMessage(formState.errors, index, "rib_24_digits") ? (
                                              <p className="mt-1 text-sm text-rose-300" role="alert">
                                                {pmFieldMessage(formState.errors, index, "rib_24_digits")}
                                              </p>
                                            ) : null}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={fieldKey}>
                                          <label className="mb-1 block text-xs font-medium text-white/55">
                                            {label}
                                          </label>
                                          <TextField
                                            autoComplete="off"
                                            {...register(`paymentMethods.${index}.${fieldKey}` as const)}
                                          />
                                          {pmFieldMessage(formState.errors, index, fieldKey) ? (
                                            <p className="mt-1 text-sm text-rose-300" role="alert">
                                              {pmFieldMessage(formState.errors, index, fieldKey)}
                                            </p>
                                          ) : null}
                                        </div>
                                      );
                                    })}

                                    {isEditing ? (
                                      <PrimaryButton
                                        type="button"
                                        className="min-w-[200px]"
                                        disabled={savingMethodId === methodMeta.id}
                                        onClick={() => void saveMethod(index, methodMeta.id)}
                                      >
                                        {savingMethodId === methodMeta.id
                                          ? "جاري الحفظ..."
                                          : "حفظ الإعدادات"}
                                      </PrimaryButton>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <PrimaryButton type="submit" className="min-w-[200px]" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "جاري الحفظ..." : "حفظ كل الإعدادات"}
            </PrimaryButton>
          </div>

          <div className="lg:sticky lg:top-6 h-fit space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">معاينة مباشرة</p>
            <GlassCard className="overflow-hidden border border-cyan-500/20 p-5 shadow-lg shadow-cyan-500/5">
              <p className="text-[10px] uppercase text-white/35">قائمة اختيار الوكيل</p>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-slate-800 text-lg font-bold text-cyan-100">
                  {agentLabel.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{agentLabel}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      <Clock size={12} className="opacity-80" />
                      {executionTime ?? "—"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activePreviewMethods.length === 0 ? (
                      <span className="text-xs text-white/40">لا توجد وسائل مفعّلة بعد</span>
                    ) : (
                      activePreviewMethods.map((m) => {
                        const Ic = METHOD_ICONS[m.id] ?? Building2;
                        return (
                          <span
                            key={m.id}
                            title={paymentMethodTitle(m.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-200"
                          >
                            <Ic size={18} strokeWidth={1.75} />
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
                هكذا تظهر أيقونات الوسائل المفعّلة وشارة زمن التنفيذ عند تصفّح اللاعبين لوكلاء متاحين.
              </p>
            </GlassCard>
          </div>
        </div>
      </form>
    </SidebarShell>
  );
}
