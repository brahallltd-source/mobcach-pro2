"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, MessageCircle, Search, UserCheck, UserPlus, Users } from "lucide-react";
import { SidebarShell, GlassCard, PageHeader, LoadingCard, StatCard } from "@/components/ui";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

type PlayerRow = {
  id: string;
  userId: string;
  email: string;
  username: string;
  phone?: string;
  status: string;
  joinedAt?: string;
  lastOrderAmount?: number;
  totalOrders?: number;
};

function waMeUrlForPhone(phone: string | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length >= 8) return `https://wa.me/${raw}`;
  return "https://wa.me/";
}

export default function MyPlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const u = await requireMobcashUserOnClient("agent");
        if (!u) {
          redirectToLogin();
          return;
        }
        const mu = u as MobcashUser;
        const agentProfileId = mu.agentProfile?.id;
        if (!agentProfileId) {
          setPlayers([]);
          return;
        }
        const res = await fetch(`/api/agent/my-players?agentId=${encodeURIComponent(agentProfileId)}`, {
          credentials: "include",
        });
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err) {
        console.error("Error loading players:", err);
      } finally {
        setLoading(false);
      }
    };
    void loadPlayers();
  }, []);

  const filtered = players.filter(
    (p) =>
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري جلب قائمة لاعبيك..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader title="قائمة لاعبيّ" subtitle="هنا تجد جميع اللاعبين المرتبطين بحسابك." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="إجمالي اللاعبين" value={String(players.length)} icon={<Users className="text-cyan-400" />} />
        <StatCard
          label="النشطون"
          value={String(players.filter((p) => p.status === "active").length)}
          icon={<UserCheck className="text-emerald-400" />}
        />
        <StatCard
          label="آخر الانضمامات"
          value={players.length > 0 ? "اليوم" : "لا يوجد"}
          icon={<UserPlus className="text-amber-400" />}
        />
      </div>

      <GlassCard className="mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="بحث بالإيميل أو اسم المستخدم..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white outline-none transition-all placeholder:text-white/35 focus:border-cyan-500/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </GlassCard>

      <div className="grid gap-3">
        {filtered.length > 0 ? (
          filtered.map((player) => (
            <GlassCard
              key={player.id}
              className="flex flex-col gap-4 p-4 transition-all hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 font-bold text-cyan-400">
                  {player.username?.slice(0, 1).toUpperCase() || "P"}
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium">{player.username}</h3>
                  <p className="truncate text-xs text-white/40">{player.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div className="hidden text-right md:block">
                  <p className="text-[10px] uppercase text-white/30">الحالة</p>
                  <span
                    className={`text-[11px] font-bold ${
                      player.status === "active" ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {player.status === "active" ? "نشط" : "معلق"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/agent/my-players/${player.id}/orders`}
                    title="الفواتير والطلبات"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-white/10 hover:text-cyan-200"
                  >
                    <FileText className="size-[18px]" />
                  </Link>
                  <Link
                    href={`/agent/chat?playerEmail=${encodeURIComponent(player.email)}`}
                    title="محادثة داخلية"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-white/10 hover:text-cyan-200"
                  >
                    <MessageCircle className="size-[18px]" />
                  </Link>
                  <a
                    href={waMeUrlForPhone(player.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="واتساب"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.883 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <div className="py-20 text-center italic opacity-40">لا يوجد لاعبون حالياً.</div>
        )}
      </div>
    </SidebarShell>
  );
}
