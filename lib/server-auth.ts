import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isUserSuspended } from "@/lib/agent-account-guard";
import { hasAdminPermission, isSuperAdminRole } from "@/lib/admin-permissions";
import type { PermissionId } from "@/lib/permissions";
import { USER_SESSION_SELECT } from "@/lib/prisma-user-safe-select";
import { loadUserPermissionsForAuth } from "@/lib/user-permissions-db";

export type AccessResult =
  | {
      ok: true;
      status: 200;
      message: "OK";
      user: {
        id: string;
        email: string;
        role: string;
        status: string;
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

const DEFAULT_MASTER_ADMIN_EMAIL = "admin@mobcash.com";

/** Emails that bypass fine-grained `permissions` checks (still must pass {@link requireAdmin}). */
export function isMasterAdminEmail(email: string | null | undefined): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  const raw = (process.env.MASTER_ADMIN_EMAIL ?? DEFAULT_MASTER_ADMIN_EMAIL).trim();
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(e);
}

/**
 * Standard admin-route denial payload (`error` is `Unauthorized` for 401, `Forbidden` for 403+).
 * Optionally merge list/empty payloads (e.g. `{ orders: [] }`) for dashboard callers.
 * Only call when `access.ok === false` (e.g. `if (!access.ok) return respondIfAdminAccessDenied(access, extras)`).
 */
export function respondIfAdminAccessDenied(
  access: AccessResult,
  extras?: Record<string, unknown>,
): NextResponse {
  if (access.ok) {
    throw new Error("respondIfAdminAccessDenied: expected denied access");
  }
  const error = access.status === 401 ? "Unauthorized" : "Forbidden";
  return NextResponse.json(
    { error, message: access.message, ...(extras ?? {}) },
    { status: access.status },
  );
}

async function getAuthUser(): Promise<AccessResult> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("mobcash_session")?.value ||
      cookieStore.get("token")?.value ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("mobcash_token")?.value;

    if (!token) {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return { ok: false, status: 500, message: "JWT_SECRET is missing" };
    }

    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    const payload = verified.payload as {
      userId?: string;
      id?: string;
    };

    const userId = payload.userId || payload.id;
    if (!userId) {
      return { ok: false, status: 401, message: "Invalid token payload" };
    }

    const prisma = getPrisma();
    if (!prisma) {
      return { ok: false, status: 500, message: "Database not available" };
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: USER_SESSION_SELECT,
    });

    if (!user) {
      return { ok: false, status: 401, message: "User not found" };
    }

    if (user.deletedAt != null) {
      return { ok: false, status: 401, message: "Account no longer available" };
    }

    return {
      ok: true,
      status: 200,
      message: "OK",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  } catch (error: unknown) {
    console.error("SERVER AUTH ERROR:", error);
    return { ok: false, status: 401, message: "Unauthorized" };
  }
}

export async function requireAdmin(): Promise<AccessResult> {
  const access = await getAuthUser();

  if (!access.ok) return access;

  const roleU = String(access.user.role).toUpperCase();
  if (roleU !== "ADMIN" && roleU !== "SUPER_ADMIN") {
    return { ok: false, status: 403, message: "Admin access required" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { ok: false, status: 500, message: "Database not available" };
  }

  const row = await prisma.user.findUnique({
    where: { id: access.user.id },
    select: { accountStatus: true, frozen: true, deletedAt: true },
  });
  if (!row || row.deletedAt != null) {
    return { ok: false, status: 403, message: "Account not available" };
  }
  if (isUserSuspended(row.accountStatus, row.frozen)) {
    return { ok: false, status: 403, message: "Account suspended" };
  }

  return access;
}

export async function requireAdminPermission(permission: PermissionId): Promise<AccessResult> {
  const access = await requireAdmin();

  if (!access.ok) return access;

  // THE BYPASS: SUPER_ADMIN — grant immediately (no `permissions` read / RBAC probe).
  // `access.user.role` comes from the DB via {@link getAuthUser} (not the JWT alone).
  if (isSuperAdminRole(access.user.role)) {
    return access;
  }

  // Master email list: same full bypass (see {@link isMasterAdminEmail}).
  if (isMasterAdminEmail(access.user.email)) {
    return access;
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { ok: false, status: 500, message: "Database not available" };
  }

  const effective = await loadUserPermissionsForAuth(prisma, access.user.id);
  if (!hasAdminPermission(effective, permission)) {
    return { ok: false, status: 403, message: "Permission denied" };
  }

  return access;
}

/** Alias for RBAC checks (same as {@link requireAdminPermission}). */
export async function requirePermission(permission: PermissionId): Promise<AccessResult> {
  return requireAdminPermission(permission);
}