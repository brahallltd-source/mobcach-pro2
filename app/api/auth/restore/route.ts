import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  type MobcashUser,
  toMobcashUserCookiePayload,
} from "@/lib/mobcash-user-types";
import { USER_SESSION_SELECT } from "@/lib/prisma-user-safe-select";
import { ALL_PERMISSION_IDS } from "@/lib/permissions";
import { loadUserPermissionsForAuth } from "@/lib/user-permissions-db";
import { signSessionToken, verifySessionToken } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestoreBody = {
  sessionToken?: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database unavailable" },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as RestoreBody;
    const rawToken = String(body.sessionToken ?? "").trim();
    if (!rawToken) {
      return NextResponse.json(
        { success: false, message: "Missing session token" },
        { status: 400 },
      );
    }

    const payload = await verifySessionToken(rawToken).catch(() => null);
    const userId = String((payload as { id?: unknown } | null)?.id ?? "").trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Invalid session token" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SESSION_SELECT,
    });
    if (!user || user.deletedAt != null) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 401 },
      );
    }

    const roleUpper = String(user.role ?? "").trim().toUpperCase();
    const adminPermissions =
      roleUpper === "SUPER_ADMIN"
        ? [...ALL_PERMISSION_IDS]
        : roleUpper === "ADMIN"
          ? await loadUserPermissionsForAuth(prisma, user.id)
          : undefined;

    const publicUser: MobcashUser = {
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

    const refreshedToken = await signSessionToken({
      id: user.id,
      role: String(user.role ?? "").toLowerCase(),
      email: user.email,
      username: user.username,
      applicationStatus: user.applicationStatus,
    });

    const cookieMaxAgeSec = 60 * 60 * 24 * 7;
    const isProd = process.env.NODE_ENV === "production";

    const cookieStore = await cookies();
    cookieStore.set("mobcash_user", JSON.stringify(toMobcashUserCookiePayload(publicUser)), {
      path: "/",
      maxAge: cookieMaxAgeSec,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });

    const res = NextResponse.json({
      success: true,
      user: publicUser,
      sessionToken: refreshedToken,
    });
    res.cookies.set("mobcash_session", refreshedToken, {
      path: "/",
      maxAge: cookieMaxAgeSec,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });
    return res;
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to restore session" },
      { status: 401 },
    );
  }
}
