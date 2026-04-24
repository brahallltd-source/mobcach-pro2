import { cookies } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { isSuperAdminRole } from "@/lib/admin-permissions";
import { ALL_PERMISSION_IDS } from "@/lib/permissions";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import { verifySessionToken } from "@/lib/security";
import { USER_SESSION_SELECT } from "@/lib/prisma-user-safe-select";
import { loadUserPermissionsForAuth } from "@/lib/user-permissions-db";

const MOBCASH_USER = "mobcash_user";

const SESSION_COOKIE_NAMES = [
  "mobcash_session",
  "token",
  "auth_token",
  "mobcash_token",
] as const;

export type SessionUserRow = Prisma.UserGetPayload<{ select: typeof USER_SESSION_SELECT }>;

/** Same JSON shape as `GET /api/auth/session` and `POST /api/login` `user` (Prisma field `player`). */
export type SessionUserPayload = MobcashUser;

function pickSessionToken(
  store: Awaited<ReturnType<typeof cookies>>,
): string | undefined {
  for (const name of SESSION_COOKIE_NAMES) {
    const v = store.get(name)?.value;
    if (v) return v;
  }
  return undefined;
}

async function toPayload(prisma: PrismaClient, user: SessionUserRow): Promise<SessionUserPayload> {
  const roleU = String(user.role ?? "").trim().toUpperCase();
  const adminPermissions =
    roleU === "SUPER_ADMIN"
      ? [...ALL_PERMISSION_IDS]
      : roleU === "ADMIN"
        ? await loadUserPermissionsForAuth(prisma, user.id)
        : undefined;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    playerStatus: user.playerStatus,
    agentProfile: user.agentProfile,
    player: user.player,
    wallet: user.wallet,
    applicationStatus: user.applicationStatus,
    hasUsdtAccess: user.hasUsdtAccess,
    rejectionReason: user.rejectionReason,
    ...(adminPermissions !== undefined ? { adminPermissions } : {}),
  };
}

/**
 * Resolves the signed-in user from HTTP-only cookies.
 *
 * 1) Prefer JWT (`mobcash_session` / legacy names): verify, load user **from DB** by `id`
 *    so `role` matches the database (not only the JWT `role` claim).
 * 2) If there is no valid JWT, fall back to `mobcash_user` JSON cookie: read `id`,
 *    load from DB — aligned with {@link middleware} which can authorize from that cookie
 *    when the token is missing or invalid.
 */
export async function getSessionUserFromCookies(): Promise<SessionUserPayload | null> {
  const store = await cookies();
  const prisma = getPrisma();
  if (!prisma) return null;

  const token = pickSessionToken(store);
  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const userId = String((payload as { id?: string }).id || "");
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: USER_SESSION_SELECT,
        });
        if (user) return await toPayload(prisma, user);
      }
    } catch {
      // Expired/invalid JWT — try `mobcash_user` id fallback below (middleware parity).
    }
  }

  const raw = store.get(MOBCASH_USER)?.value;
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const data = JSON.parse(decoded) as { id?: unknown };
    const userId = data.id != null ? String(data.id) : "";
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SESSION_SELECT,
    });
    return user ? await toPayload(prisma, user) : null;
  } catch {
    return null;
  }
}
