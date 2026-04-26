/**
 * Fine-grained admin RBAC. Stored on `User.permissions` as `String[]` of these ids.
 * Legacy lowercase keys from the previous JSON array are normalized on read.
 */

export const PERMISSIONS = [
  {
    id: "MANAGE_USERS",
    label: "Manage users",
    description: "Create admins, freeze agents, applications, agent list, player admin tools.",
  },
  {
    id: "APPROVE_RECHARGES",
    label: "Approve recharges",
    description: "Approve or reject recharge / top-up requests.",
  },
  {
    id: "MANUAL_BALANCE_EDIT",
    label: "Manual balance edit",
    description: "Add or subtract wallet balance directly (manual adjust).",
  },
  {
    id: "VIEW_FINANCIALS",
    label: "View financials",
    description: "Dashboard KPIs, analytics, ledger export, orders, withdrawals, fraud views.",
  },
  {
    id: "MANAGE_SETTINGS",
    label: "Manage settings",
    description: "Branding, system settings, global banner, payment methods.",
  },
  {
    id: "SUPPORT_TICKETS",
    label: "Support tickets",
    description: "Support inbox and ticket replies.",
  },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

const CANONICAL = new Set<string>(PERMISSIONS.map((p) => p.id));

/** Maps legacy permission strings (pre-RBAC) to one or more canonical ids. */
const LEGACY_TO_NEW: Record<string, PermissionId[]> = {
  overview: ["VIEW_FINANCIALS"],
  manage_users: ["MANAGE_USERS"],
  agents: ["MANAGE_USERS"],
  players: ["MANAGE_USERS"],
  approve_recharge: ["APPROVE_RECHARGES"],
  wallets: ["APPROVE_RECHARGES"],
  orders: ["VIEW_FINANCIALS"],
  fraud: ["VIEW_FINANCIALS"],
  withdrawals: ["VIEW_FINANCIALS"],
  branding: ["MANAGE_SETTINGS"],
  notifications: ["VIEW_FINANCIALS"],
  bonus_claims: ["VIEW_FINANCIALS"],
};

export function isValidPermissionId(id: string): id is PermissionId {
  return CANONICAL.has(id);
}

/** Normalize DB value: expand legacy keys, dedupe, keep only canonical ids. */
export function normalizeStoredPermissions(raw: unknown): PermissionId[] {
  if (raw == null) return [];
  let list: unknown[] | null = null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      list = Array.isArray(parsed) ? parsed : null;
    } catch {
      list = null;
    }
    if (list == null) return [];
  } else if (Array.isArray(raw)) {
    list = raw;
  } else {
    return [];
  }
  const out = new Set<PermissionId>();
  for (const x of list) {
    const s = String(x).trim();
    if (!s) continue;
    if (isValidPermissionId(s)) {
      out.add(s);
      continue;
    }
    const mapped = LEGACY_TO_NEW[s];
    if (mapped) {
      for (const m of mapped) out.add(m);
    }
  }
  return [...out];
}

export function defaultPermissionsForNewAdmin(): PermissionId[] {
  return [
    "VIEW_FINANCIALS",
    "MANAGE_USERS",
    "APPROVE_RECHARGES",
    "MANAGE_SETTINGS",
    "SUPPORT_TICKETS",
  ];
}

export function hasPermission(effective: PermissionId[], permission: PermissionId): boolean {
  return effective.includes(permission);
}

/** All ids (e.g. SUPER_ADMIN UI / session hydration). */
export const ALL_PERMISSION_IDS: PermissionId[] = PERMISSIONS.map((p) => p.id);

/** Sidebar: minimum permission to show each admin route. */
export const ADMIN_ROUTE_PERMISSION: Record<string, PermissionId> = {
  "/admin/dashboard": "VIEW_FINANCIALS",
  "/admin/settings": "MANAGE_SETTINGS",
  "/admin/broadcast": "MANAGE_SETTINGS",
  "/admin/agent-applications": "MANAGE_USERS",
  "/admin/agents": "MANAGE_USERS",
  "/admin/users": "MANAGE_USERS",
  "/admin/support": "SUPPORT_TICKETS",
  "/admin/payment-methods": "MANAGE_SETTINGS",
  "/admin/recharge-requests": "APPROVE_RECHARGES",
  "/admin/history": "VIEW_FINANCIALS",
  "/admin/admins": "MANAGE_USERS",
  "/admin/orders": "VIEW_FINANCIALS",
  "/admin/orders-history": "VIEW_FINANCIALS",
  "/admin/withdrawals": "VIEW_FINANCIALS",
  "/admin/branding": "MANAGE_SETTINGS",
  "/admin/launch-check": "MANAGE_SETTINGS",
  "/admin/analytics": "VIEW_FINANCIALS",
  "/admin/fraud": "VIEW_FINANCIALS",
  "/admin/affiliate-network": "MANAGE_USERS",
};
