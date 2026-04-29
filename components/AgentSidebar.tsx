/**
 * Canonical agent primary navigation (11 items). Labels use {@link agentT} with `labelKey`.
 * Legacy Arabic-only map kept for older imports.
 */
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  CreditCard,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { AgentTranslationKey } from "@/lib/i18n/dictionaries/agent";

export { SIDEBAR_AGENT_AR } from "@/lib/constants/i18n";

export type AgentNavConfigItem = {
  href: string;
  labelKey: AgentTranslationKey;
  icon: LucideIcon;
};

export const AGENT_NAV_ITEMS: AgentNavConfigItem[] = [
  { href: "/agent/dashboard", labelKey: "sidebar_dashboard", icon: LayoutDashboard },
  { href: "/agent/my-players", labelKey: "sidebar_my_players", icon: Users },
  { href: "/agent/add-requests", labelKey: "sidebar_add_requests", icon: ClipboardList },
  { href: "/agent/player-recharge-requests", labelKey: "sidebar_player_recharge_requests", icon: Inbox },
  { href: "/agent/all-history", labelKey: "sidebar_all_history", icon: History },
  { href: "/agent/chat", labelKey: "sidebar_chat", icon: MessageCircle },
  { href: "/agent/gosport365-topup", labelKey: "sidebar_gs365_topup", icon: Wallet },
  { href: "/agent/invitations-rewards", labelKey: "sidebar_invitations_rewards", icon: UserPlus },
  { href: "/agent/settings/payments", labelKey: "sidebar_payment_settings", icon: CreditCard },
  { href: "/agent/settings/general", labelKey: "sidebar_settings", icon: Settings },
  { href: "/agent/support", labelKey: "sidebar_support", icon: LifeBuoy },
];
