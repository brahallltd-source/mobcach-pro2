"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, MessageCircleMore, Clock, ShieldCheck } from "lucide-react";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";
import {
  EmptyState,
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextField,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GS365_GLOW } from "@/lib/ui/gs365-glow";
import { usePlayerTx } from "@/hooks/usePlayerTx";

type Msg = {
  senderRole: string;
  message: string;
  created_at?: string;
  createdAt?: string;
};

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  paymentMethodName?: string;
  gosportUsername?: string;
  playerApproved?: boolean;
  messages?: Msg[];
};

type MainTab = "ongoing" | "fulfilled";
type FilterTab = "all" | "unpaid" | "paid" | "appeal" | "completed" | "cancelled";

function getMainTab(order: Order): MainTab {
  if (order.status === "completed" || order.status === "cancelled") return "fulfilled";
  return "ongoing";
}

function getFilterTab(order: Order): FilterTab {
  if (order.status === "completed") return "appeal";
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "agent_approved_waiting_player") return "paid";
  if (
    order.status === "proof_uploaded" ||
    order.status === "pending_payment" ||
    order.status === "flagged_for_review"
  ) {
    return "unpaid";
  }
  return "all";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function lastMessageFromOtherParty(messages?: Msg[]) {
  if (!messages?.length) return false;
  const last = messages[messages.length - 1];
  return last.senderRole !== "player";
}

export default function PlayerOrdersPage() {
  const tp = usePlayerTx();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadHint, setLoadHint] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("ongoing");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      let u = await fetchSessionUser();
      if (!u) {
        await new Promise((r) => setTimeout(r, 200));
        u = await fetchSessionUser();
      }
      if (!u || String((u as { role?: string }).role ?? "").toLowerCase() !== "player") {
        redirectToLogin();
        return;
      }
      try {
        localStorage.setItem("mobcash_user", JSON.stringify(u));
      } catch {
        /* ignore */
      }

      const res = await fetch("/api/player/orders", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { orders?: Order[] };
      if (res.ok) {
        setLoadHint(null);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } else {
        setOrders([]);
        if (res.status === 401 || res.status === 403) {
          setLoadHint(tp("orders.sessionErrorHint"));
        } else {
          setLoadHint(tp("orders.loadErrorHint"));
        }
      }
      setLoading(false);
    })();
  }, [tp]);

  const counts = useMemo(() => {
    const ongoing = orders.filter((order) => getMainTab(order) === "ongoing").length;
    const fulfilled = orders.filter((order) => getMainTab(order) === "fulfilled").length;
    return { ongoing, fulfilled };
  }, [orders]);

  const filterOptions = useMemo(() => {
    if (mainTab === "ongoing") {
      return [
        { key: "all" as const, label: tp("orders.filterAll") },
        { key: "unpaid" as const, label: tp("orders.filterUnpaid") },
        { key: "paid" as const, label: tp("orders.filterPaid") },
      ];
    }

    return [
      { key: "all" as const, label: tp("orders.filterAll") },
      { key: "appeal" as const, label: tp("orders.filterAppeal") },
      { key: "cancelled" as const, label: tp("orders.filterCancelled") },
    ];
  }, [mainTab, tp]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders
      .filter((order) => getMainTab(order) === mainTab)
      .filter((order) => (filter === "all" ? true : getFilterTab(order) === filter))
      .filter((order) => {
        if (!q) return true;
        return (
          order.id.toLowerCase().includes(q) ||
          String(order.gosportUsername || "").toLowerCase().includes(q) ||
          String(order.paymentMethodName || "").toLowerCase().includes(q)
        );
      });
  }, [orders, mainTab, filter, query]);

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text={tp("orders.loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title={tp("orders.pageTitle")}
        subtitle={tp("orders.pageSubtitle")}
        action={
          <Link href="/player/achat">
            <PrimaryButton>{tp("orders.newRechargeRequest")}</PrimaryButton>
          </Link>
        }
      />

      {loadHint ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="status">
          {loadHint}
        </p>
      ) : null}

      <GlassCard className="overflow-hidden border-primary/25 bg-white/[0.04] p-0 shadow-xl backdrop-blur-md">
        <div className="border-b border-white/10 px-4 pt-4 md:px-6">
          <div className="flex items-center gap-4 text-lg font-semibold md:gap-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMainTab("ongoing");
                setFilter("all");
              }}
              className={clsx(
                "relative rounded-none px-2 pb-4 text-base font-semibold hover:bg-transparent hover:text-white/85",
                mainTab === "ongoing" ? "text-cyan-300" : "text-white/55"
              )}
            >
              {tp("orders.tabsOngoing")}
              {mainTab === "ongoing" ? (
                <span className="absolute bottom-0 start-0 h-[3px] w-full rounded-full bg-cyan-400" />
              ) : null}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMainTab("fulfilled");
                setFilter("all");
              }}
              className={clsx(
                "relative rounded-none px-2 pb-4 text-base font-semibold hover:bg-transparent hover:text-white/85",
                mainTab === "fulfilled" ? "text-cyan-300" : "text-white/55"
              )}
            >
              {tp("orders.tabsFulfilled")}
              {mainTab === "fulfilled" ? (
                <span className="absolute bottom-0 start-0 h-[3px] w-full rounded-full bg-cyan-400" />
              ) : null}
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={filter === item.key ? "default" : "outline"}
                  onClick={() => setFilter(item.key)}
                  className={clsx(
                    "rounded-2xl px-4 py-2 text-sm font-semibold",
                    filter === item.key && "bg-cyan-400 text-slate-950 shadow-md hover:bg-cyan-300"
                  )}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative min-w-[220px]">
                <Search
                  className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={16}
                />
                <TextField
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tp("orders.searchPlaceholder")}
                  className="ps-11"
                />
              </div>

              <div
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-muted/10 px-4 text-sm text-white/60"
                aria-hidden
              >
                <SlidersHorizontal size={16} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-muted/10 px-4 py-3 text-sm text-white/65">
            {mainTab === "ongoing"
              ? tp("orders.ongoingCount", { count: String(counts.ongoing) })
              : tp("orders.fulfilledCount", { count: String(counts.fulfilled) })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={tp("orders.emptyTitle")}
              subtitle={
                mainTab === "ongoing"
                  ? tp("orders.emptyOngoing")
                  : tp("orders.emptyFulfilled")
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((order) => {
                const hasUnread = lastMessageFromOtherParty(order.messages);
                const detailHref = `/player/orders/${order.id}`;

                return (
                  <Link key={order.id} href={detailHref} className="block">
                    <Card className={`h-full ${GS365_GLOW.cardShell} ${GS365_GLOW.cardShellInteractive}`}>
                      <CardContent className={`${GS365_GLOW.cardInner} h-full`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="bg-gradient-to-r from-emerald-300 via-amber-200 to-teal-300 bg-clip-text text-4xl font-black tabular-nums tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]">
                                {order.amount.toLocaleString()}{" "}
                                <span className="text-xl font-semibold text-white/60">DH</span>
                              </p>
                              <StatusBadge status={order.status} />
                              {hasUnread ? (
                                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                                  <MessageCircleMore size={14} />
                                  {tp("orders.newMessage")}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-3 text-sm text-slate-300">
                              <span className="font-medium text-white/80">
                                {order.paymentMethodName || tp("orders.methodPending")}
                              </span>{" "}
                              • {order.gosportUsername || tp("orders.usernamePending")}
                            </p>

                            <div className="mt-4 grid gap-2 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-2">
                              <p>
                                <span className="text-slate-500">{tp("orders.labelOrder")}</span> {order.id.split("-")[0]}
                              </p>
                              <p>
                                <span className="text-slate-500">{tp("orders.labelCreated")}</span> {formatDate(order.createdAt)}
                              </p>
                              <p>
                                <span className="text-slate-500">{tp("orders.labelUpdated")}</span>{" "}
                                {formatDate(order.updatedAt || order.createdAt)}
                              </p>
                              <p className="capitalize">
                                <span className="text-slate-500">{tp("orders.labelFlow")}</span>{" "}
                                {getFilterTab(order).replaceAll("_", " ")}
                              </p>
                            </div>

                            {order.status === "pending_payment" ? (
                              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
                                <Clock size={16} /> {tp("orders.statusPendingPaymentHint")}
                              </div>
                            ) : null}

                            {order.status === "proof_uploaded" || order.status === "flagged_for_review" ? (
                              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                                <Clock size={16} /> {tp("orders.statusProofUploadedHint")}
                              </div>
                            ) : null}

                            {order.status === "agent_approved_waiting_player" ? (
                              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                                <ShieldCheck size={16} /> {tp("orders.statusApprovedHint")}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-row gap-3 lg:flex-col">
                            <span
                              className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${GS365_GLOW.ctaButton}`}
                            >
                              {order.status === "pending_payment"
                                ? tp("orders.ctaPayNow")
                                : tp("orders.ctaViewDetails")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </SidebarShell>
  );
}