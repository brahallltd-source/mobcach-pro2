"use client";

import { GlassCard } from "@/components/ui";
import { formatCurrencyDhEn } from "@/lib/format-dh";
import type { RechargeRequestRow } from "@/components/admin/recharge-request-row-types";

type Props = {
  row: RechargeRequestRow;
};

function promoUsed(row: RechargeRequestRow): number {
  const v = row.promo_bonus_used ?? row.invitationAffiliateDh ?? 0;
  return Number(v) || 0;
}

function bonus10(row: RechargeRequestRow): number {
  return Number(row.bonus_10 ?? row.bonus10Percent) || 0;
}

function totalCredit(row: RechargeRequestRow): number {
  return Number(row.totalWithBonusApprox) || 0;
}

export function RechargeRequestFinancialAuditCard({ row }: Props) {
  const base = Number(row.amount) || 0;
  const b10 = bonus10(row);
  const promo = promoUsed(row);
  const total = totalCredit(row);
  const verified = Boolean(row.promo_bonus_system_verified) && promo > 0;

  return (
    <GlassCard className="border border-white/10 bg-slate-950/70 p-4 shadow-xl backdrop-blur-xl">
      <div dir="rtl">
      <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-bold text-white/90">
        بطاقة المراجعة المالية
      </h3>
      <ul className="space-y-3 text-sm">
        <li className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.06] px-3 py-2.5">
          <span className="text-white/80">المبلغ المدفوع (Base Amount)</span>
          <span className="font-semibold tabular-nums text-white" dir="ltr">
            {formatCurrencyDhEn(base)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4 rounded-lg bg-sky-500/10 px-3 py-2.5 ring-1 ring-sky-400/20">
          <span className="text-sky-100/90">بونص الشحن (10% Bonus)</span>
          <span className="font-semibold tabular-nums text-sky-200" dir="ltr">
            {formatCurrencyDhEn(b10)}
          </span>
        </li>
        {promo > 0 ? (
          <li className="flex items-center justify-between gap-4 rounded-lg bg-amber-500/10 px-3 py-2.5 ring-1 ring-amber-400/25">
            <span className="flex flex-wrap items-center gap-2 text-amber-100/95">
              بونص الترويج المستخدم (Promo Bonus)
              {verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  <span aria-hidden>✅</span>
                  نظام الإحالة مؤكد
                </span>
              ) : null}
            </span>
            <span className="font-semibold tabular-nums text-amber-200" dir="ltr">
              {formatCurrencyDhEn(promo)}
            </span>
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
          <span className="font-bold text-white/90">الإجمالي النهائي (Total to Credit)</span>
          <span className="text-lg font-extrabold tabular-nums text-emerald-300" dir="ltr">
            {formatCurrencyDhEn(total)}
          </span>
        </li>
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        يشمل الإجمالي المبلغ الأساسي وبونص الشحن المسجّل مع الطلب
        {promo > 0 ? " وبونص الترويج المخزّن في الطلب" : ""}. قد تُضاف مكافآت أخرى من نظام
        الطاقة/المستويات عند الموافقة.
      </p>
      </div>
    </GlassCard>
  );
}
