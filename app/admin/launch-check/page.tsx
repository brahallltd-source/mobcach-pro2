
"use client";

import { useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell, StatCard } from "@/components/ui";

type CheckRow = { key: string; label: string; ok: boolean; detail: string };

export default function AdminLaunchCheckPage() {
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const rows: CheckRow[] = [];
      try {
        const healthRes = await fetch("/api/health", { cache: "no-store", credentials: "include" });
        const health = await healthRes.json();
        rows.push({ key: "health", label: "Health endpoint", ok: Boolean(health.ok), detail: health.ok ? `Database: ${health.database}` : "Health check failed" });
      } catch { rows.push({ key: "health", label: "Health endpoint", ok: false, detail: "Request failed" }); }
      setChecks(rows);
      setLoading(false);
    };
    run();
  }, []);

  const passed = checks.filter((item) => item.ok).length;

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Running launch checks..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Launch check" subtitle="Quick localhost and pre-launch validation before official deployment." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Checks passed" value={`${passed}/${checks.length}`} hint="Fast operational validation" />
        <StatCard label="Health" value={checks.find((item) => item.key === "health")?.ok ? "OK" : "Issue"} hint="App + database connection" />
        <StatCard label="Ready status" value={passed === checks.length ? "Go" : "Review"} hint="Fix failed rows before launch" />
      </div>
      <div className="space-y-4">
        {checks.map((item) => <GlassCard key={item.key} className="p-6"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-xl font-semibold">{item.label}</h3><p className="mt-2 text-sm text-white/60">{item.detail}</p></div><div className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${item.ok ? "bg-emerald-400/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{item.ok ? "passed" : "failed"}</div></div></GlassCard>)}
      </div>
    </SidebarShell>
  );
}
