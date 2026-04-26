"use client";

import { Info } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { GlassCard } from "@/components/ui";
import { useAgentTranslation } from "@/hooks/useTranslation";

function formatDh(value: number, lang: Lang): string {
  const locale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US";
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${n} DH`;
}

export type Gs365TopupSummaryCardProps = {
  /** Raw value from the amount field (shown literally + " DH"). */
  amountRaw: string;
  /** Platform recharge bonus rate (e.g. 0.10). */
  standardBonusRate: number;
  /** Label percentage (e.g. 10) for copy. */
  standardBonusPctLabel: number;
  /** Fetched invitation milestone pool (DH). */
  availablePromotionDh: number;
  applyRewards: boolean;
  onApplyRewardsChange: (next: boolean) => void;
  isCrypto: boolean;
  /** USDT to send for treasury leg (base + standard only). */
  requiredUsdt: string | null;
  /** When false, hide invitation / promotion UI (admin disabled merge in system settings). */
  affiliateFeatureEnabled: boolean;
};

export function Gs365TopupSummaryCard({
  amountRaw,
  standardBonusRate,
  standardBonusPctLabel,
  availablePromotionDh,
  applyRewards,
  onApplyRewardsChange,
  isCrypto,
  requiredUsdt,
  affiliateFeatureEnabled,
}: Gs365TopupSummaryCardProps) {
  const { am, lang, dir } = useAgentTranslation();
  const rawTrim = String(amountRaw ?? "").trim();
  const base = parseFloat(rawTrim);
  const baseOk = Number.isFinite(base) && base > 0;
  const standardBonus = baseOk ? base * standardBonusRate : 0;
  const promotionApplied =
    affiliateFeatureEnabled && applyRewards && availablePromotionDh > 0
      ? availablePromotionDh
      : 0;
  const grandTotal = baseOk ? base + standardBonus + promotionApplied : 0;
  const promoTip = am("topup.summary.promotionTooltip");

  return (
    <GlassCard className="relative mt-3 overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] via-emerald-950/40 to-slate-950/90 p-[1px] shadow-[0_0_48px_-12px_rgba(16,185,129,0.45)] backdrop-blur-xl">
      <div dir={dir} className="rounded-2xl bg-slate-950/55 px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <h3 className="text-sm font-bold tracking-wide text-amber-100/95">{am("topup.summary.title")}</h3>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200/90">
            {am("topup.summary.badge")}
          </span>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/65">{am("topup.summary.requestedAmount")}</dt>
            <dd className="text-end font-semibold tabular-nums text-white" dir="ltr">
              {rawTrim ? `${rawTrim} DH` : "—"}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-amber-200/80">
              {am("bonus.recurring", { pct: String(standardBonusPctLabel) })}
            </dt>
            <dd
              className="text-end text-base font-semibold tabular-nums text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]"
              dir="ltr"
            >
              {baseOk ? formatDh(standardBonus, lang) : "—"}
            </dd>
          </div>

          {affiliateFeatureEnabled ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 pt-0.5 text-emerald-200/85">
                  <span>{am("topup.summary.promotionAvailable")}</span>
                  <span
                    className="inline-flex cursor-help text-emerald-300/70"
                    title={promoTip}
                    aria-label={promoTip}
                  >
                    <Info className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </span>
                </dt>
                <dd
                  className="text-end text-base font-semibold tabular-nums text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.4)]"
                  dir="ltr"
                >
                  {formatDh(availablePromotionDh, lang)}
                </dd>
              </div>

              <div className="flex flex-col gap-2 border-t border-emerald-500/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer select-none items-start gap-3 text-xs text-white/85">
                  <input
                    type="checkbox"
                    checked={applyRewards}
                    onChange={(e) => onApplyRewardsChange(e.target.checked)}
                    disabled={availablePromotionDh <= 0}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400/45 bg-black/40 text-emerald-500 shadow-inner shadow-amber-900/20 focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-0 disabled:opacity-40"
                  />
                  <span className="font-semibold leading-snug text-amber-50/95">{am("topup.summary.applyPromotion")}</span>
                </label>
              </div>
            </>
          ) : null}

          <div className="flex items-baseline justify-between gap-4 border-t border-amber-400/15 pt-3">
            <dt className="text-base font-semibold text-white/90">{am("topup.summary.total")}</dt>
            <dd
              className="text-end text-xl font-extrabold tabular-nums tracking-tight bg-gradient-to-r from-emerald-300 via-amber-200 to-teal-300 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(52,211,153,0.55)] sm:text-2xl"
              dir="ltr"
            >
              {baseOk ? formatDh(grandTotal, lang) : "—"}
            </dd>
          </div>
        </dl>

        {isCrypto && requiredUsdt ? (
          <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
            <p className="text-center text-sm font-semibold text-amber-200/95" dir="ltr">
              {am("topup.summary.mustSendUsdt", { amount: requiredUsdt })}
            </p>
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
