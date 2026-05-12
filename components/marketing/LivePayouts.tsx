"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";

type TopWinner = {
  id: string;
  user: string;
  amountDh: number;
  method: string;
  ageHours: number;
};

type RegularWinner = {
  id: string;
  user: string;
  amountDh: number;
  method: "CIH Bank" | "Cash Plus" | "Attijari";
  ageHours: number;
};

type WinnerRow = {
  id: string;
  user: string;
  amount: string;
  method: string;
  ageHours: number;
  isTop: boolean;
};

const TOP_ROTATION_DAYS = 5; // stable for 3-7 days range
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const TOP_WINNERS_POOL: TopWinner[] = [
  { id: "t1", user: "n***8", amountDh: 6750, method: "USDT", ageHours: 3 },
  { id: "t2", user: "k***1", amountDh: 11300, method: "USDT", ageHours: 6 },
  { id: "t3", user: "s***4", amountDh: 8900, method: "USDT", ageHours: 9 },
  { id: "t4", user: "a***6", amountDh: 12450, method: "USDT", ageHours: 12 },
  { id: "t5", user: "f***2", amountDh: 5400, method: "USDT", ageHours: 15 },
  { id: "t6", user: "h***9", amountDh: 14900, method: "USDT", ageHours: 19 },
  { id: "t7", user: "r***3", amountDh: 7600, method: "USDT", ageHours: 22 },
  { id: "t8", user: "z***5", amountDh: 10100, method: "USDT", ageHours: 8 },
];

const REGULAR_WINNERS_POOL: RegularWinner[] = [
  { id: "r1", user: "m***3", amountDh: 350, method: "Cash Plus", ageHours: 4 },
  { id: "r2", user: "r***1", amountDh: 820, method: "Attijari", ageHours: 7 },
  { id: "r3", user: "y***0", amountDh: 200, method: "CIH Bank", ageHours: 10 },
  { id: "r4", user: "t***6", amountDh: 1050, method: "Cash Plus", ageHours: 14 },
  { id: "r5", user: "f***7", amountDh: 490, method: "Attijari", ageHours: 18 },
  { id: "r6", user: "d***1", amountDh: 780, method: "CIH Bank", ageHours: 21 },
  { id: "r7", user: "q***7", amountDh: 240, method: "Cash Plus", ageHours: 25 },
  { id: "r8", user: "u***3", amountDh: 950, method: "Attijari", ageHours: 31 },
  { id: "r9", user: "l***2", amountDh: 620, method: "CIH Bank", ageHours: 36 },
  { id: "r10", user: "w***9", amountDh: 1490, method: "Cash Plus", ageHours: 42 },
  { id: "r11", user: "c***4", amountDh: 430, method: "Attijari", ageHours: 48 },
  { id: "r12", user: "x***1", amountDh: 1170, method: "CIH Bank", ageHours: 53 },
  { id: "r13", user: "e***8", amountDh: 560, method: "Cash Plus", ageHours: 58 },
  { id: "r14", user: "j***6", amountDh: 1320, method: "Attijari", ageHours: 9 },
  { id: "r15", user: "p***5", amountDh: 710, method: "CIH Bank", ageHours: 27 },
  { id: "r16", user: "b***0", amountDh: 390, method: "Cash Plus", ageHours: 45 },
  { id: "r17", user: "g***2", amountDh: 880, method: "Attijari", ageHours: 16 },
  { id: "r18", user: "o***7", amountDh: 1150, method: "CIH Bank", ageHours: 33 },
  { id: "r19", user: "v***4", amountDh: 275, method: "Cash Plus", ageHours: 51 },
  { id: "r20", user: "i***9", amountDh: 1420, method: "Attijari", ageHours: 23 },
];

function formatDh(amountDh: number) {
  return `${amountDh.toLocaleString("en-US")} DH`;
}

function pickUniqueRegularWinners(seed: number, count: number): RegularWinner[] {
  const out: RegularWinner[] = [];
  const used = new Set<number>();
  let cursor = seed;
  while (out.length < count) {
    const idx = cursor % REGULAR_WINNERS_POOL.length;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(REGULAR_WINNERS_POOL[idx]);
    }
    cursor += 3;
  }
  return out;
}

function formatAgeLabel(tx: (path: string, vars?: Record<string, string>) => string, ageHours: number) {
  if (ageHours < 24) {
    return tx("home.livePayouts.hoursAgo", { hours: String(ageHours) });
  }
  if (ageHours < 48) return tx("home.livePayouts.yesterday");
  const days = Math.max(2, Math.floor(ageHours / 24));
  return tx("home.livePayouts.daysAgo", { days: String(days) });
}

export function LivePayouts() {
  const { tx } = useTranslation();

  const visibleWinners = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / MS_PER_DAY);

    const topSeed = Math.floor(dayIndex / TOP_ROTATION_DAYS);
    const top = TOP_WINNERS_POOL[topSeed % TOP_WINNERS_POOL.length];

    // Rotate regular rows every 2 or 3 days (deterministically).
    const regularRotationDays = 2 + (Math.floor(dayIndex / 14) % 2);
    const regularSeed = Math.floor(dayIndex / regularRotationDays);
    const regularCount = 3 + (regularSeed % 3); // 3..5
    const regularWinners = pickUniqueRegularWinners(regularSeed, regularCount);

    const rows: WinnerRow[] = [
      {
        id: `top-${top.id}`,
        user: top.user,
        amount: formatDh(top.amountDh),
        method: top.method,
        ageHours: top.ageHours,
        isTop: true,
      },
      ...regularWinners.map((winner) => ({
        id: `regular-${winner.id}`,
        user: winner.user,
        amount: formatDh(winner.amountDh),
        method: winner.method,
        ageHours: winner.ageHours,
        isTop: false,
      })),
    ];

    return rows;
  }, []);

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">{tx("home.livePayouts.liveBadge")}</span>
          <h3 className="text-sm font-semibold text-white md:text-base">{tx("home.livePayouts.title")}</h3>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {visibleWinners.map((winner) => (
            <div
              key={winner.id}
              className={
                winner.isTop
                  ? "animate-golden-glow-pulse flex items-center justify-between rounded-xl border border-amber-300/55 bg-gradient-to-r from-amber-500/12 via-yellow-400/8 to-amber-500/12 px-3 py-2"
                  : "flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              }
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white/90">
                  {winner.user} <span className="text-white/45">• {winner.method}</span>
                </p>
                <p className="text-[11px] text-white/45">
                  {formatAgeLabel(tx, winner.ageHours)}
                </p>
              </div>
              <p
                className={
                  winner.isTop
                    ? "shrink-0 text-emerald-400 font-bold drop-shadow-[0_0_10px_rgba(52,211,153,0.65)]"
                    : "shrink-0 text-emerald-300 font-semibold"
                }
              >
                {winner.amount}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

