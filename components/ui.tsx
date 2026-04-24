"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ADMIN_ROUTE_PERMISSION, ALL_PERMISSION_IDS } from "@/lib/permissions";
import { getOrderStatusTone } from "@/lib/order-utils";
import {
  Bell,
  History,
  CircleDollarSign,
  LayoutDashboard,
  MessageCircle,
  Package,
  Users,
  Languages,
  Settings,
  Wallet,
  Menu,
  X,
  Zap,
  LogOut,
  Sparkles,
  ShoppingCart,
  UserRound,
  ShieldCheck,
  ClipboardList,
  Archive,
  CreditCard,
  ShieldAlert,
  LifeBuoy,
  Receipt,
  UserPlus,
} from "lucide-react";
// 🟢 المحرك الجديد ديالنا
import { useTranslation, LANGS } from "@/lib/i18n";
import { NotificationBell } from "@/components/NotificationBell";
import {
  formatArabicChatOverflowBadge,
  formatArabicUnreadBadge,
  SIDEBAR_AGENT_AR,
  SIDEBAR_PLAYER_AR,
} from "@/lib/constants/i18n";
import { BRANDING } from "@/lib/branding";
import { Logo } from "@/components/ui/Logo";
import { PlayerBottomNav } from "@/components/PlayerBottomNav";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/cn";

// --- 1. Branding Logic (Original) ---
type Branding = {
  brandName: string;
  logoUrl: string;
  heroImages: string[];
};

const defaultBranding: Branding = {
  brandName: BRANDING.name,
  logoUrl: "",
  heroImages: [],
};

function useBranding() {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/branding?v=${Date.now()}`, { 
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        const data = await res.json();
        if (data?.branding) {
          setBranding({ ...defaultBranding, ...data.branding });
          localStorage.setItem("mobcash_branding", JSON.stringify(data.branding));
        }
      } catch (err) {
        console.error("Branding fetch failed:", err);
      }
    };
    void load();
  }, []);
  return branding;
}

// --- 2. Language Switcher (Built-in) ---
export function LanguageSwitcher() {
  const { setLang, lang } = useTranslation();
  return (
    <div className="flex gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
      {LANGS.map((l) => (
        <button
          key={l.value}
          onClick={() => setLang(l.value)}
          className={clsx(
            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
            lang === l.value ? "bg-white text-slate-950 shadow-lg" : "text-white/40 hover:text-white"
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// --- 3. Base Layout Components ---
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "relative rounded-[28px] border border-white/[0.08] bg-white/[0.03] shadow-2xl backdrop-blur-xl transition-all hover:bg-white/[0.05]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
  compact,
  hideBranding,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /** Merged onto the outer `GlassCard` (padding, etc.). */
  className?: string;
  /** Tighter padding and vertical rhythm (e.g. player dashboard welcome). */
  compact?: boolean;
  /** Omit logo + product strip (shell already shows the mark). */
  hideBranding?: boolean;
}) {
  const branding = useBranding();
  return (
    <GlassCard
      className={clsx(
        "overflow-hidden",
        compact ? "p-4 md:p-5" : "p-6 md:p-8",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.15),transparent_32%)]" />
      <div
        className={clsx(
          "relative flex flex-col md:flex-row md:items-center md:justify-between",
          compact ? "gap-2 md:gap-3" : "gap-4"
        )}
      >
        <div>
          {!hideBranding ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 px-2.5 py-1.5">
              <Logo src={branding.logoUrl || undefined} heightClass="h-7" className="opacity-95" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/95">
                {branding.brandName}
              </span>
            </div>
          ) : null}
          {typeof title === "string" ? (
            <h1
              className={clsx(
                "font-semibold tracking-tight text-white",
                compact ? "text-2xl md:text-4xl" : "text-3xl md:text-5xl",
                hideBranding ? "mt-0" : compact ? "mt-2" : "mt-4"
              )}
            >
              {title}
            </h1>
          ) : (
            <div className={clsx(hideBranding ? "mt-0" : compact ? "mt-2" : "mt-4")}>{title}</div>
          )}
          {subtitle ? (
            <p
              className={clsx(
                "max-w-3xl text-sm leading-6 text-white/60 md:text-base",
                compact ? "mt-2" : "mt-3"
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </GlassCard>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { dir } = useTranslation();
  const branding = useBranding();
  return (
    <main dir={dir} className="min-h-screen bg-transparent px-6 py-8 text-white md:px-8">
      <Navbar className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center">
          <Link href="/" className="inline-flex shrink-0 transition hover:opacity-90" aria-label={branding.brandName}>
            <Logo src={branding.logoUrl || undefined} heightClass="h-10 md:h-12" />
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white shadow-none backdrop-blur-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            )}
          >
            تسجيل الدخول
          </Link>
        </div>
      </Navbar>
      {children}
    </main>
  );
}

// --- 4. Navigation Logic (Original Items Protected) ---
type Role = "player" | "agent" | "admin";
type NavItem = { href: string; label: string; icon: any; mobileLabel?: string };

function getNav(
  role: Role,
  t: (key: string) => string,
  tx: (path: string, vars?: Record<string, string>) => string,
  adminPermSet: Set<string> | null = null
) {
  const player: NavItem[] = [
    { href: "/player/dashboard", label: SIDEBAR_PLAYER_AR.overview, icon: LayoutDashboard, mobileLabel: SIDEBAR_PLAYER_AR.overview },
    { href: "/player/achat", label: SIDEBAR_PLAYER_AR.newOrder, icon: ShoppingCart, mobileLabel: SIDEBAR_PLAYER_AR.newOrder },
    { href: "/player/orders", label: SIDEBAR_PLAYER_AR.orders, icon: Package, mobileLabel: SIDEBAR_PLAYER_AR.orders },
    { href: "/player/chat", label: SIDEBAR_PLAYER_AR.chat, icon: MessageCircle, mobileLabel: SIDEBAR_PLAYER_AR.chat },
    { href: "/player/winnings", label: SIDEBAR_PLAYER_AR.winnings, icon: CircleDollarSign, mobileLabel: SIDEBAR_PLAYER_AR.winnings },
    { href: "/player/profile", label: SIDEBAR_PLAYER_AR.profile, icon: UserRound, mobileLabel: SIDEBAR_PLAYER_AR.profile },
  ];

  const agent: NavItem[] = [
    { href: "/agent/dashboard", label: SIDEBAR_AGENT_AR.home, icon: LayoutDashboard },
    { href: "/agent/my-players", label: SIDEBAR_AGENT_AR.myPlayers, icon: Users },
    { href: "/agent/invite", label: SIDEBAR_AGENT_AR.invites, icon: UserPlus },
    { href: "/agent/requests", label: SIDEBAR_AGENT_AR.linkRequests, icon: ClipboardList },
    { href: "/agent/requests-history", label: SIDEBAR_AGENT_AR.requestsHistory, icon: Archive },
    {
      href: "/agent/recharge/history",
      label: SIDEBAR_AGENT_AR.operationsLog,
      icon: History,
    },
    { href: "/agent/settings/payments", label: SIDEBAR_AGENT_AR.paymentSettings, icon: CreditCard },
    { href: "/agent/transactions", label: SIDEBAR_AGENT_AR.paymentProofs, icon: Receipt },
    { href: "/agent/orders", label: SIDEBAR_AGENT_AR.orders, icon: Package },
    { href: "/agent/chat", label: SIDEBAR_AGENT_AR.chat, icon: MessageCircle },
    { href: "/agent/activations", label: SIDEBAR_AGENT_AR.activations, icon: ShieldCheck },
    { href: "/agent/invite-agent", label: SIDEBAR_AGENT_AR.inviteAgent, icon: Zap },
    { href: "/agent/recharge", label: SIDEBAR_AGENT_AR.recharge, icon: Wallet },
    {
      href: "/agent/recharge-from-admin",
      label: SIDEBAR_AGENT_AR.balanceFromAdmin,
      icon: Wallet,
    },
    { href: "/agent/withdrawals", label: SIDEBAR_AGENT_AR.withdrawals, icon: CircleDollarSign },
    { href: "/agent/winner-requests", label: SIDEBAR_AGENT_AR.winnerRequests, icon: Bell },
    { href: "/agent/bonus", label: SIDEBAR_AGENT_AR.bonus, icon: Zap },
    { href: "/agent/settings/general", label: SIDEBAR_AGENT_AR.settings, icon: Settings },
    { href: "/agent/support", label: SIDEBAR_AGENT_AR.support, icon: LifeBuoy },
  ];

  const admin: NavItem[] = [
    { href: "/admin/dashboard", label: t("overview") || "Overview", icon: LayoutDashboard },
    { href: "/admin/settings", label: tx("sidebar.systemSettings"), icon: Settings },
    { href: "/admin/agent-applications", label: tx("sidebar.applications"), icon: Users },
    { href: "/admin/agents", label: t("agents") || "Agent List", icon: Users },
    { href: "/admin/users", label: tx("sidebar.users"), icon: UserRound },
    { href: "/admin/support", label: tx("sidebar.supportInbox"), icon: LifeBuoy },
    { href: "/admin/payment-methods", label: t("paymentMethods") || "Payment Methods", icon: Wallet },
    { href: "/admin/recharge-requests", label: t("rechargeRequests") || "Recharge Requests", icon: Wallet },
    { href: "/admin/history", label: tx("sidebar.historyArchive"), icon: History },
    { href: "/admin/admins", label: t("admins") || "Admins", icon: Users },
    { href: "/admin/orders", label: t("orders") || "Orders", icon: Package },
    { href: "/admin/orders-history", label: "سجل شحن اللاعبين", icon: ClipboardList },
    { href: "/admin/withdrawals", label: t("withdrawals") || "Payouts", icon: CircleDollarSign },
    { href: "/admin/branding", label: t("branding") || "Branding", icon: Sparkles },
    { href: "/admin/launch-check", label: t("launchCheck") || "Launch Check", icon: ShieldCheck },
    { href: "/admin/analytics", label: t("analytics") || "Analytics", icon: CreditCard },
    { href: "/admin/fraud", label: t("fraud") || "Fraud", icon: ShieldAlert },
  ];

  if (role === "player") return player;
  if (role === "agent") return agent;
  if (!adminPermSet) {
    return admin;
  }
  return admin.filter((item) => {
    const required = ADMIN_ROUTE_PERMISSION[item.href];
    if (!required) return true;
    return adminPermSet.has(required);
  });
}

export function SidebarShell({ children, role }: { children: ReactNode; role: Role }) {
  const pathname = usePathname();
  const { t, tx, dir } = useTranslation();
  const branding = useBranding();
  const [adminPermSet, setAdminPermSet] = useState<Set<string> | null>(null);
  const nav = useMemo(() => getNav(role, t, tx, adminPermSet), [role, t, tx, adminPermSet]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wideLayout, setWideLayout] = useState(false);
  const [agentMaintenance, setAgentMaintenance] = useState<boolean | null>(null);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const j = (await res.json()) as {
          success?: boolean;
          user?: { role?: string; adminPermissions?: string[] };
        };
        if (cancelled) return;
        if (!j.success || !j.user) {
          setAdminPermSet(new Set());
          return;
        }
        const u = j.user;
        const roleU = String(u.role ?? "").trim().toUpperCase();
        if (roleU === "SUPER_ADMIN") {
          setAdminPermSet(new Set(ALL_PERMISSION_IDS));
        } else {
          setAdminPermSet(new Set(Array.isArray(u.adminPermissions) ? u.adminPermissions : []));
        }
      } catch {
        if (!cancelled) setAdminPermSet(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWideLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const saved = localStorage.getItem("mobcash_user");
        if (!saved) return;
        const user = JSON.parse(saved);
        const role = String(user.role).toLowerCase();
        const targetId = role === "agent" ? (user.agentId || user.id) : (user.email || user.playerEmail);
        const res = await fetch(`/api/notifications?role=${role}&targetId=${targetId}`);
        const data = await res.json();
        setUnreadCount((data.notifications || []).filter((n: any) => !n.read).length);
      } catch (err) {}
    };
    checkUpdates();
    const interval = setInterval(checkUpdates, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (role !== "agent") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/agent/system-context", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { isMaintenance?: unknown };
        if (!cancelled) {
          setAgentMaintenance(Boolean(j.isMaintenance));
        }
      } catch {
        if (!cancelled) {
          setAgentMaintenance(false);
        }
      }
    };
    void tick();
    const iv = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [role]);

  const logout = () => {
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("mobcash_user");
      window.location.href = "/login";
    });
  };

  return (
    <main dir={dir} className="min-h-screen bg-transparent px-6 py-8 text-white md:px-8">
      <div className="mx-auto flex max-w-7xl gap-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="mb-6 hidden scale-90 items-center justify-between gap-4 origin-end lg:flex">
            <NotificationBell active={wideLayout} />
            <LanguageSwitcher />
          </div>
          <GlassCard className="sticky top-5 flex min-h-[600px] flex-col p-5">
            <div className="mb-6 border-b border-white/5 pb-5">
              <Link
                href="/"
                className="flex flex-col items-start gap-2 transition hover:opacity-90"
                aria-label={branding.brandName}
              >
                <Logo src={branding.logoUrl || undefined} heightClass="h-9" />
                {role === "player" ? (
                  <span className="truncate text-sm font-semibold text-white/90">{branding.brandName}</span>
                ) : null}
              </Link>
            </div>
            <nav className="flex-1 space-y-2">
              {nav.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                const highContrastNav = role === "admin" || role === "agent";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "relative flex min-h-[48px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold",
                      highContrastNav && "group transition-colors",
                      highContrastNav
                        ? [
                            "border border-transparent",
                            active
                              ? "border-0 border-l-4 border-l-primary bg-white/10 font-bold text-white"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                          ]
                        : [
                            "border border-transparent transition",
                            active
                              ? "border-white/[0.08] bg-white/[0.07] text-primary shadow-[0_0_24px_rgba(34,211,238,0.07)]"
                              : "text-white/75 hover:border-white/10 hover:bg-white/10 hover:text-white",
                          ],
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className={clsx(
                        "shrink-0",
                        highContrastNav
                          ? active
                            ? "text-white"
                            : "text-slate-400 group-hover:text-slate-200"
                          : active && "text-primary",
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/player/chat" && unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-bounce">
                        {formatArabicChatOverflowBadge(unreadCount)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              <LogOut size={18} strokeWidth={1.5} />
              {(t as (k: string) => string)("logout")}
            </button>
          </GlassCard>
        </aside>

        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/90 transition hover:bg-white/10"
              aria-label="القائمة"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-2">
              <NotificationBell active={!wideLayout} />
              <LanguageSwitcher />
            </div>
          </div>

          {open && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 backdrop-blur-md lg:hidden">
              <div className="max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
                    aria-label={branding.brandName}
                  >
                    <Logo src={branding.logoUrl || undefined} heightClass="h-10" />
                    {role === "player" ? (
                      <span className="truncate text-lg font-semibold text-white">{branding.brandName}</span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition hover:bg-white/10"
                    aria-label="إغلاق"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="space-y-2">
                  {nav.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    const highContrastNav = role === "admin" || role === "agent";
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "relative flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-base font-semibold",
                          highContrastNav && "group transition-colors",
                          highContrastNav
                            ? [
                                "border border-transparent",
                                active
                                  ? "border-0 border-l-4 border-l-primary bg-white/10 font-bold text-white"
                                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                              ]
                            : [
                                "border transition",
                                active
                                  ? "border-white/[0.12] bg-white/[0.08] text-primary shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                                  : "border-transparent bg-white/[0.04] text-white/80 hover:border-white/10 hover:bg-white/[0.08] hover:text-white",
                              ],
                        )}
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.5}
                          className={clsx(
                            "shrink-0",
                            highContrastNav
                              ? active
                                ? "text-white"
                                : "text-slate-400 group-hover:text-slate-200"
                              : active && "text-primary",
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/player/chat" && unreadCount > 0 && (
                          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
                            {formatArabicChatOverflowBadge(unreadCount)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-white/85 transition hover:bg-white/10"
                >
                  <LogOut size={20} strokeWidth={1.5} />
                  {(t as (k: string) => string)("logout")}
                </button>
              </div>
            </div>
          )}
          {role === "agent" && agentMaintenance ? (
            <div
              className="mb-8 rounded-2xl border border-amber-500/45 bg-amber-500/15 px-5 py-4 text-sm font-semibold text-amber-50 shadow-lg shadow-amber-950/30 md:px-6"
              role="alert"
            >
              وضع الصيانة نشط — لا يمكن تنفيذ بعض الإجراءات (مثل الشحن أو إضافة لاعبين) حتى يعطل المسؤول وضع
              الصيانة.
            </div>
          ) : null}
          {children}
        </div>
      </div>

      {role === "player" ? <PlayerBottomNav items={nav} unreadChatCount={unreadCount} /> : null}
    </main>
  );
}

// --- 5. Inputs & Buttons (Original) ---
export function TextField({ className = "", value, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      {...(value !== undefined && value !== null ? { value } : {})}
      className={clsx(
        "w-full rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        className
      )}
    />
  );
}

/** Accessible toggle for boolean settings (e.g. payment method visibility). */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
      className={clsx(
        "relative h-8 w-14 shrink-0 rounded-full border border-white/15 transition-colors",
        checked ? "bg-primary" : "bg-white/15",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={clsx(
          "pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
          checked && "translate-x-6"
        )}
      />
    </button>
  );
}

export function SelectField({ className = "", value, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      {...(value !== undefined && value !== null ? { value } : {})}
      className={clsx(
        "w-full rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm text-white outline-none transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        className
      )}
    />
  );
}
export function TextArea({ className = "", value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      {...(value !== undefined && value !== null ? { value } : {})}
      className={clsx(
        "w-full rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        className
      )}
    />
  );
}
export function PrimaryButton({ children, className = "", ...props }: any) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:translate-y-[-1px] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

const outlineControlClassName =
  "inline-flex items-center justify-center rounded-2xl border border-primary/45 bg-transparent px-5 py-3 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/10 hover:border-primary/70 disabled:opacity-50";

/** Outline / secondary — matches `PrimaryButton` radius and weight for auth & settings flows. */
export function OutlineButton({ children, className = "", ...props }: any) {
  return (
    <button {...props} className={clsx(outlineControlClassName, className)}>
      {children}
    </button>
  );
}

export function OutlineLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={clsx(outlineControlClassName, className)}>
      {children}
    </Link>
  );
}

/** Outline-style action control (auth / pending pages). Alias of {@link OutlineButton}. */
export const Button = OutlineButton;

export function DangerButton({ children, className = "", ...props }: any) {
  return <button {...props} className={clsx("rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50", className)}>{children}</button>;
}

// --- 6. Helpers (Original) ---
export function LoadingCard({ text }: { text: string }) { return <GlassCard className="p-10 text-center text-white/65">{text}</GlassCard>; }
export function NavPill({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return <Link href={href} className={clsx("rounded-full px-4 py-2.5 text-sm font-semibold transition", active ? "bg-white text-slate-950" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white")}>{label}</Link>;
}
export function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl transition-all hover:bg-white/[0.05]">
      <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold uppercase tracking-wider text-white/40">{label}</p>{icon && <div className="text-cyan-400">{icon}</div>}</div>
      <h3 className="text-2xl font-bold text-white">{value}</h3>{hint && <p className="mt-1 text-xs text-white/30">{hint}</p>}
    </div>
  );
}
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return <GlassCard className="p-10 text-center"><h3 className="text-2xl font-semibold">{title}</h3>{subtitle ? <p className="mt-3 text-sm text-white/60">{subtitle}</p> : null}</GlassCard>;
}
export function StatusBadge({ status }: { status: string }) {
  const tone = getOrderStatusTone(status);
  return <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", tone)}>{status.replaceAll("_", " ")}</span>;
}

export { Logo } from "@/components/ui/Logo";
export { PlayerBottomNav } from "@/components/PlayerBottomNav";
export { Navbar } from "@/components/Navbar";
export { FadeIn, StaggerContainer, StaggerItem } from "@/components/animations";