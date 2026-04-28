"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function PlayerWaitingRoomGate({
  deadlineIso,
  agentName,
}: {
  deadlineIso: string;
  agentName?: string | null;
}) {
  const deadlineMs = useMemo(() => new Date(deadlineIso).getTime(), [deadlineIso]);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadlineMs - nowMs);
  const expired = remaining <= 0;

  return (
    <main className="min-h-screen bg-transparent px-6 py-8 text-white md:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <GlassCard className="w-full space-y-6 border-cyan-500/25 p-8 text-center md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
            {expired ? <Lock className="h-8 w-8 text-cyan-300" /> : <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />}
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              طلبك قيد المراجعة. سيقوم الوكيل بتزويدك ببيانات GoSport365 قريباً.
            </h1>
            {agentName ? (
              <p className="text-sm text-white/65">
                الوكيل الحالي: <span className="font-semibold text-white">{agentName}</span>
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="mb-2 text-xs uppercase tracking-widest text-white/45">24H Approval Window</p>
            <p className="font-mono text-4xl font-black tracking-wider text-cyan-300">{formatRemaining(remaining)}</p>
            <p className="mt-2 text-xs text-white/50">
              {expired
                ? "انتهت مهلة 24 ساعة. تواصل مع الوكيل أو الدعم إذا لم يتم التفعيل."
                : "سيتم فتح لوحة اللاعب تلقائياً بعد التفعيل."}
            </p>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
