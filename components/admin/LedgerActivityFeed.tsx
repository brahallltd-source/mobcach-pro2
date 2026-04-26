"use client";

import { ArrowDownLeft, ArrowUpRight, ScrollText } from "lucide-react";
import { clsx } from "clsx";
import { formatNumberEn } from "@/lib/format-dh";
import { localeForLang, useTranslation } from "@/lib/i18n";

export type LedgerFeedEntry = {
  id: string;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
  agentId: string;
  agentLabel: string;
};

function amountTone(amount: number): string {
  if (amount > 0) return "text-emerald-300";
  if (amount < 0) return "text-rose-300";
  return "text-white/60";
}

export function LedgerActivityFeed({ entries }: { entries: LedgerFeedEntry[] }) {
  const { lang, tx } = useTranslation();
  const locale = localeForLang(lang);

  if (!entries.length) {
    return <p className="py-6 text-center text-sm text-white/40">{tx("admin.ledger.empty")}</p>;
  }

  return (
    <ul className="max-h-[360px] space-y-2 overflow-y-auto pe-1 ps-1">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
        >
          <div className="mt-0.5 shrink-0 text-white/45">
            {e.amount >= 0 ? (
              <ArrowDownLeft className="h-4 w-4 text-emerald-400/90" aria-hidden />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-rose-400/90" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate font-medium text-white/90">{e.reason || e.type}</span>
              <span className={clsx("shrink-0 text-xs font-bold tabular-nums", amountTone(e.amount))} dir="ltr">
                {e.amount > 0 ? "+" : ""}
                {formatNumberEn(e.amount, 2)} DH
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-white/45">{e.agentLabel}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/35" dir="ltr">
              <ScrollText className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              {e.type}
              <span className="mx-1 text-white/20">·</span>
              {new Date(e.createdAt).toLocaleString(locale)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
