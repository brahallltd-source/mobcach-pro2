"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { getOrderStatusTone } from "@/lib/order-utils";
import {
  Bell,
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
  CreditCard,
  ShieldAlert,
} from "lucide-react";
// 🟢 المحرك الجديد ديالنا
import { useTranslation, LANGS } from "@/lib/i18n";

// --- 1. Branding Logic (Original) ---
type Branding = {
  brandName: string;
  logoUrl: string;
  heroImages: string[];
};

const defaultBranding: Branding = {
  brandName: "GS365Cash",
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

function BrandMark() {
  const branding = useBranding();
  if (branding.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.brandName} className="h-9 w-9 rounded-xl object-contain" />;
  }
  return (
    <span className="rounded-xl bg-cyan-400/15 p-2 text-cyan-200">
      <Languages size={16} />
    </span>
  );
}

// --- 3. Base Layout Components ---
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-glass", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const branding = useBranding();
  return (
    <GlassCard className="overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.15),transparent_32%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-200">
            {branding.brandName}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 md:text-base">{subtitle}</p> : null}
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
    <main dir={dir} className="min-h-screen bg-hero px-4 py-6 text-white md:px-6">
      <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="transition hover:opacity-80">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.brandName} className="h-16 md:h-20 xl:h-24 object-contain" />
            ) : (
              <span className="text-2xl font-bold tracking-tighter">{branding.brandName}</span>
            )}
          </Link>
        </div>
        <LanguageSwitcher />
      </div>
      {children}
    </main>
  );
}

// --- 4. Navigation Logic (Original Items Protected) ---
type Role = "player" | "agent" | "admin";
type NavItem = { href: string; label: string; icon: any; mobileLabel?: string };

function getNav(role: Role, t: any) {
  const player: NavItem[] = [
    { href: "/player/dashboard", label: t("overview") || "Overview", icon: LayoutDashboard, mobileLabel: "Home" },
    { href: "/player/achat", label: t("achat") || "New Order", icon: ShoppingCart, mobileLabel: "New" },
    { href: "/player/orders", label: t("orders") || "Orders", icon: Package, mobileLabel: "Orders" },
    { href: "/player/chat", label: t("chat") || "Chat", icon: MessageCircle, mobileLabel: "Chat" },
    { href: "/player/winnings", label: t("winnings") || "Winnings", icon: CircleDollarSign, mobileLabel: "Win" },
    { href: "/player/profile", label: t("myProfile") || "Profile", icon: UserRound, mobileLabel: "Profile" },
  ];

  const agent: NavItem[] = [
    { href: "/agent/dashboard", label: t("overview") || "Overview", icon: LayoutDashboard },
    { href: "/agent/orders", label: t("orders") || "Orders", icon: Package },
    { href: "/agent/chat", label: t("chat") || "Chat", icon: MessageCircle },
    { href: "/agent/add-player", label: t("addPlayer") || "Add Player", icon: Users },
    { href: "/agent/activations", label: "Activations", icon: ShieldCheck },
    { href: "/agent/invite-agent", label: "Invite Agent", icon: Zap },
    { href: "/agent/recharge", label: t("recharge") || "Recharge", icon: Wallet },
    { href: "/agent/withdrawals", label: "Withdrawals", icon: CircleDollarSign },
    { href: "/agent/winner-requests", label: t("winnings") || "Winner Requests", icon: Bell },
    { href: "/agent/bonus", label: "Bonus", icon: Zap },
    { href: "/agent/settings", label: t("settings") || "Settings", icon: Settings },
  ];

  const admin: NavItem[] = [
    { href: "/admin/dashboard", label: t("overview") || "Overview", icon: LayoutDashboard },
    { href: "/admin/agent-applications", label: "Applications", icon: Users },
    { href: "/admin/agents", label: t("agents") || "Agent List", icon: Users },
    { href: "/admin/payment-methods", label: t("paymentMethods") || "Payment Methods", icon: Wallet },
    { href: "/admin/recharge-requests", label: t("rechargeRequests") || "Recharge Requests", icon: Wallet },
    { href: "/admin/admins", label: t("admins") || "Admins", icon: Users },
    { href: "/admin/orders", label: t("orders") || "Orders", icon: Package },
    { href: "/admin/withdrawals", label: t("withdrawals") || "Payouts", icon: CircleDollarSign },
    { href: "/admin/branding", label: t("branding") || "Branding", icon: Sparkles },
    { href: "/admin/launch-check", label: t("launchCheck") || "Launch Check", icon: ShieldCheck },
    { href: "/admin/analytics", label: t("analytics") || "Analytics", icon: CreditCard },
    { href: "/admin/fraud", label: t("fraud") || "Fraud", icon: ShieldAlert },
  ];

  if (role === "player") return player;
  if (role === "agent") return agent;
  return admin;
}

export function SidebarShell({ children, role }: { children: ReactNode; role: Role }) {
  const pathname = usePathname();
  const { t, dir } = useTranslation();
  const branding = useBranding();
  const nav = getNav(role, t);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const logout = () => {
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("mobcash_user");
      window.location.href = "/login";
    });
  };

  return (
    <main dir={dir} className="min-h-screen bg-hero px-4 py-5 text-white md:px-6">
      <div className="mx-auto flex max-w-7xl gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="mb-4 flex justify-end scale-90 origin-right"><LanguageSwitcher /></div>
          <GlassCard className="sticky top-5 p-5 flex flex-col min-h-[600px]">
            <div className="mb-6 flex items-center gap-3 border-b border-white/5 pb-5">
              <Link href="/" className="flex items-center gap-3 text-lg font-semibold transition hover:opacity-80">
                <BrandMark /><span className="truncate">{branding.brandName}</span>
              </Link>
            </div>
            <nav className="space-y-1.5 flex-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={clsx("relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition", active ? "bg-white text-slate-950 shadow-lg" : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white")}>
                    <Icon size={16} /><span className="flex-1">{item.label}</span>
                    {item.label === t("chat") && unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-bounce">{unreadCount}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <button onClick={logout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">
              <LogOut size={16} />{(t as any)("logout")}
            </button>
          </GlassCard>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <button onClick={() => setOpen(true)} className="rounded-2xl border border-white/10 bg-white/5 p-3"><Menu size={18} /></button>
            <LanguageSwitcher />
          </div>

          {open && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 p-4 backdrop-blur-md lg:hidden">
              <div className="max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/10 bg-[#0B0F19] p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 text-lg font-semibold"><BrandMark /><span>{branding.brandName}</span></Link>
                  <button onClick={() => setOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-2"><X size={16} /></button>
                </div>
                <div className="space-y-2">
                  {nav.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={clsx("relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition", active ? "bg-white text-slate-950" : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white")}>
                        <item.icon size={16} />{item.label}
                        {item.label === t("chat") && unreadCount > 0 && <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-bounce">{unreadCount > 9 ? "+9" : unreadCount}</span>}
                      </Link>
                    );
                  })}
                </div>
                <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"><LogOut size={16} />Logout</button>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>

      {role === "player" && (
        <div className="fixed bottom-3 left-3 right-3 z-40 rounded-[28px] border border-white/10 bg-slate-950/85 p-2 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-6 gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center justify-center rounded-2xl px-2 py-3 text-[11px] font-semibold transition", active ? "bg-white text-slate-950" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                  <div className="relative"><item.icon size={16} />{item.label === t("chat") && unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-md">{unreadCount}</span>}</div>
                  <span className="mt-1">{item.mobileLabel || item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

// --- 5. Inputs & Buttons (Original) ---
export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} value={props.value ?? ""} className={clsx("w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30", props.className)} />;
}
export function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none", props.className)} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} value={props.value ?? ""} className={clsx("w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30", props.className)} />;
}
export function PrimaryButton({ children, className = "", ...props }: any) {
  return <button {...props} className={clsx("rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] disabled:opacity-50", className)}>{children}</button>;
}
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
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
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