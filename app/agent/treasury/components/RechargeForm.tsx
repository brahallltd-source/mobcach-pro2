"use client";

import { useEffect, useMemo } from "react";
import { useForm, useFormState, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  rechargeSchema,
  mapTreasuryDetailsToApi,
} from "@/lib/validations/recharge";
import { PrimaryButton } from "@/components/ui";
import { clsx } from "clsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-offset-0 placeholder:text-white/35 focus:border-primary/50 focus:ring-1 focus:ring-primary/30";

const labelClass = "block text-sm font-medium text-white/75";

/** Mock Cloudinary URL so server-side Cloudinary checks pass when using real API. */
const MOCK_RECEIPT_URL =
  "https://res.cloudinary.com/demo/image/upload/v1680000000/receipts/mock-receipt.png";

type Props = {
  /**
   * When `true`, POST to `/api/agent/recharge` (treasury). When `false`, only simulates latency
   * then resets (per strict task / demos).
   */
  submitToApi?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
};

export function RechargeForm({
  submitToApi = false,
  onSuccess,
  onCancel,
  className = "",
}: Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(rechargeSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      amount: undefined as unknown as number,
      method: "CIH",
      details: "",
      motif: "",
      receiptUrl: "",
    },
  });

  const { isValid, isSubmitting } = useFormState({ control });
  const method = watch("method");

  useEffect(() => {
    setValue("details", "", { shouldValidate: true });
    clearErrors("details");
  }, [method, setValue, clearErrors]);

  const detailsField = useMemo(() => {
    switch (method) {
      case "CIH":
        return {
          label: "رقم الحساب البنكي (RIB)",
          placeholder: "أدخل 24 رقماً...",
          inputMode: "numeric" as const,
        };
      case "ORANGE_MONEY":
      case "JIBI":
      case "MTCASH":
      case "DABAPAY":
        return {
          label: "رقم الهاتف المرتبط بالمحفظة",
          placeholder: "06... أو 07...",
          inputMode: "tel" as const,
        };
      case "SKRILL":
        return {
          label: "البريد الإلكتروني لـ Skrill",
          placeholder: "name@example.com",
          inputMode: undefined,
        };
      default:
        return {
          label: "التفاصيل",
          placeholder: "",
          inputMode: undefined,
        };
    }
  }, [method]);

  return (
    <form
      dir="rtl"
      onSubmit={handleSubmit(async (values) => {
        clearErrors("root");
        try {
          if (submitToApi) {
            const detailsPayload = mapTreasuryDetailsToApi(values.method, values.details);
            const res = await fetch("/api/agent/recharge", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                treasuryTopUp: true,
                amount: values.amount,
                method: values.method,
                details: detailsPayload,
                motif: values.motif.trim(),
                receiptUrl: values.receiptUrl.trim(),
              }),
            });
            const data = (await res.json().catch(() => ({}))) as {
              success?: boolean;
              message?: string;
            };
            if (!res.ok || !data.success) {
              setError("root", {
                type: "server",
                message: data.message || "فشل الإرسال",
              });
              return;
            }
          } else {
            await new Promise((r) => setTimeout(r, 650));
          }
          reset();
          onSuccess?.();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "فشل الإرسال";
          setError("root", { type: "server", message: msg });
        }
      })}
      className={clsx(
        "rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner md:p-5",
        className,
      )}
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="treasury-amount">
            المبلغ (DH)
          </label>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <input
                id="treasury-amount"
                type="number"
                min={100}
                step="0.01"
                className={inputClass}
                placeholder="100"
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  field.onChange(raw === "" ? undefined : raw);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          {errors.amount ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {errors.amount.message as string}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="treasury-method">
            وسيلة الدفع
          </label>
          <select id="treasury-method" className={inputClass} {...register("method")}>
            <option value="CIH">CIH / بنكي</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="JIBI">Jibi</option>
            <option value="MTCASH">MTCash</option>
            <option value="DABAPAY">DabaPay</option>
            <option value="SKRILL">Skrill</option>
          </select>
          {errors.method ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {errors.method.message as string}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="treasury-details">
            {detailsField.label}
          </label>
          <input
            id="treasury-details"
            type={method === "SKRILL" ? "email" : "text"}
            inputMode={detailsField.inputMode}
            autoComplete="off"
            placeholder={detailsField.placeholder}
            className={inputClass}
            {...register("details")}
          />
          {errors.details ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {errors.details.message as string}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="treasury-motif">
            مرجع العملية (Motif)
          </label>
          <textarea
            id="treasury-motif"
            rows={3}
            className={clsx(inputClass, "min-h-[88px] resize-y")}
            placeholder="ثلاثة أحرف على الأقل…"
            {...register("motif")}
          />
          {errors.motif ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {errors.motif.message as string}
            </p>
          ) : null}
        </div>

        <div>
          <span className={labelClass}>إيصال الدفع (محاكاة Cloudinary)</span>
          <div className="mt-2">
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 sm:w-auto"
              onClick={() =>
                setValue("receiptUrl", MOCK_RECEIPT_URL, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            >
              محاكاة رفع الإيصال (Cloudinary)
            </button>
          </div>
          <label className="mt-3 block text-xs text-white/50" htmlFor="treasury-receipt-url">
            رابط الإيصال
          </label>
          <input
            id="treasury-receipt-url"
            type="url"
            className={inputClass}
            placeholder="https://res.cloudinary.com/..."
            {...register("receiptUrl")}
          />
          {errors.receiptUrl ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {errors.receiptUrl.message as string}
            </p>
          ) : null}
        </div>

        {errors.root?.message ? (
          <p className="text-sm text-red-400" role="alert">
            {String(errors.root.message)}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            إلغاء
          </button>
        ) : null}
        <PrimaryButton type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? "جاري الإرسال…" : "إرسال الطلب"}
        </PrimaryButton>
      </div>
    </form>
  );
}
