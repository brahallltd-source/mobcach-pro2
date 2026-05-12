"use client";

import { useMemo } from "react";
import { Headphones, Lock, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function PlayerSecuritySection() {
  const { tx } = useTranslation();
  const securityPillars = useMemo(
    () =>
      [
        {
          id: "fraud-protection",
          Icon: ShieldCheck,
          iconClassName: "h-10 w-10 text-emerald-400 mb-4",
          title: tx("security.fraud.title"),
          description: tx("security.fraud.description"),
        },
        {
          id: "guarantee",
          Icon: Lock,
          iconClassName: "h-10 w-10 text-cyan-400 mb-4",
          title: tx("security.guarantee.title"),
          description: tx("security.guarantee.description"),
        },
        {
          id: "support",
          Icon: Headphones,
          iconClassName: "h-10 w-10 text-indigo-400 mb-4",
          title: tx("security.support.title"),
          description: tx("security.support.description"),
        },
      ] as const,
    [tx],
  );
  return (
    <section className="relative overflow-hidden py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.05),transparent_55%)]"
        aria-hidden
      />

      <div className="relative space-y-10">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white md:text-4xl">{tx("security.title")}</h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-400 md:text-base">
            {tx("security.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {securityPillars.map((pillar) => (
            <article
              key={pillar.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all hover:bg-white/[0.05]"
            >
              <pillar.Icon className={pillar.iconClassName} aria-hidden />
              <h3 className="text-xl font-bold text-white">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{pillar.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

