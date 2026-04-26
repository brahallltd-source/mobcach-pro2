import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import {
  ACCOUNT_SUSPENDED_AR,
  isUserSuspended,
  MAINTENANCE_BLOCK_AR,
} from "@/lib/agent-account-guard";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { ALL_PERMISSION_IDS } from "@/lib/permissions";
import { USER_SESSION_SELECT } from "@/lib/prisma-user-safe-select";
import { loadUserPermissionsForAuth } from "@/lib/user-permissions-db";
import { normalize } from "@/lib/json";
import {
  type MobcashUser,
  toMobcashUserCookiePayload,
} from "@/lib/mobcash-user-types";
import { signSessionToken, verifyPassword } from "@/lib/security";

export const runtime = "nodejs";

export type LoginUserPayload = Prisma.UserGetPayload<{ select: typeof USER_SESSION_SELECT }>;

function isActiveStatus(status: string): boolean {
  const u = String(status || "").trim().toUpperCase();
  /** `PENDING_AGENT` / `PENDING_APPROVAL` may sign in for linking or waiting on the agent. */
  return u === "ACTIVE" || u === "PENDING_AGENT" || u === "PENDING_APPROVAL";
}

/** Successful `POST /api/login` JSON body. */
export type LoginSuccessResponse = {
  success: true;
  /** Same shape as `GET /api/auth/session` — uses Prisma field name `player`. */
  user: MobcashUser;
  /** Preferred first navigation after login (client may ignore and use role defaults). */
  redirectAfterLogin?: string;
};

/** `POST /api/login` error shape — always set `message` to the reason (do not only rely on `status` text). */
export type LoginErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  const log = (step: string, extra?: Record<string, unknown>) =>
    console.log("[login]", step, extra ?? {});

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cleanIdentifier: string = normalize(String(body.identifier ?? ""));
    const cleanPassword: string = String(body.password ?? "");

    if (!cleanIdentifier || !cleanPassword) {
      log("fail: missing identifier or password (body invalid)", {
        hasIdentifier: Boolean(cleanIdentifier),
        hasPassword: Boolean(cleanPassword),
      });
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: "Request must include a non-empty identifier and password in the JSON body.",
          error: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    log("step: request ok", { identifier: cleanIdentifier });

    if (!isDatabaseEnabled()) {
      log("fail: database not enabled");
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: "Database is not enabled. Set DATABASE_URL and enable the database in app configuration.",
          error: "DATABASE_DISABLED",
        },
        { status: 500 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      log("fail: prisma client null");
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: "Database client is not available. Check DATABASE_URL and Prisma setup.",
          error: "DATABASE_UNAVAILABLE",
        },
        { status: 500 }
      );
    }

    log("step: querying user");
    const user: LoginUserPayload | null = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
      },
      select: USER_SESSION_SELECT,
    });

    if (!user) {
      log("fail: user not found for identifier", { identifier: cleanIdentifier });
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: "User not found for the given email or username.",
          error: "USER_NOT_FOUND",
        },
        { status: 401 }
      );
    }

    log("step: user found", {
      id: user.id,
      role: user.role,
      status: user.status,
    });

    if (user.deletedAt != null) {
      log("fail: account removed");
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: "This account is no longer active.",
          error: "ACCOUNT_REMOVED",
        },
        { status: 403 }
      );
    }

    if (!isActiveStatus(user.status)) {
      log("fail: account not active", { status: user.status });
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: `Account is not active (status: ${String(user.status)}). Only ACTIVE accounts can sign in.`,
          error: "ACCOUNT_INACTIVE",
        },
        { status: 403 }
      );
    }

    log("step: status active, verifying password");
    const storedHash = String(user.passwordHash || "");
    const isDev = process.env.NODE_ENV === "development";
    const studioPasswordBypass = isDev && process.env.STUDIO_DEV_SKIP_PASSWORD === "1";

    let passwordOk: boolean = await verifyPassword(
      cleanPassword,
      storedHash
    );

    if (!passwordOk && isDev) {
      const trimmedMatch = await verifyPassword(
        cleanPassword.trim(),
        storedHash.trim()
      );
      if (trimmedMatch) {
        log("dev: password ok after .trim() on input and passwordHash", {
          hint: "If you use Prisma Studio, remove accidental spaces in passwordHash or in the form.",
        });
        passwordOk = true;
      }
    }

    if (!passwordOk && studioPasswordBypass) {
      console.warn(
        "\n[login] ━━━ STUDIO_DEV_SKIP_PASSWORD: PASSWORD CHECK BYPASSED (dev only) ━━━\n" +
          `  userId=${user.id}  Unset this env before production. \n[login] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      );
      log("dev bypass: STUDIO_DEV_SKIP_PASSWORD=1 — allowed without a matching password");
      passwordOk = true;
    }

    if (!passwordOk) {
      const looksBcrypt = /^\$2[ayb]\$/.test(storedHash);
      const storedEmpty = !storedHash.trim();
      const exactPasswordMessage = storedEmpty
        ? "This account has no passwordHash in the database. Set a bcrypt or plain value in the User row, then try again (common after manual Prisma Studio entry)."
        : !looksBcrypt
          ? "The password is incorrect, or the stored password value does not match a bcrypt hash and does not match as plain text (check for extra spaces/characters in passwordHash)."
          : "The password is incorrect, or the stored hash does not match the password you entered.";

      console.log(
        "[login] ━━━ PASSWORD CHECK FAILED (see `possibleReason` in next line) ━━━"
      );
      log("fail: password check failed (401)", {
        messageSentToClient: exactPasswordMessage,
        storedFieldEmpty: storedEmpty,
        storedLooksLikeBcrypt: looksBcrypt,
        inDevelopment: isDev,
        devBypassEnv:
          isDev
            ? "STUDIO_DEV_SKIP_PASSWORD=1 allows bypass in development only"
            : undefined,
      });
      return NextResponse.json<LoginErrorResponse>(
        { success: false, message: exactPasswordMessage, error: "INVALID_PASSWORD" },
        { status: 401 }
      );
    }

    log("step: password matched");

    if (isUserSuspended(user.accountStatus, user.frozen)) {
      log("fail: account suspended or frozen", {
        accountStatus: user.accountStatus,
        frozen: user.frozen,
      });
      return NextResponse.json<LoginErrorResponse>(
        {
          success: false,
          message: ACCOUNT_SUSPENDED_AR,
          error: "ACCOUNT_SUSPENDED",
        },
        { status: 403 }
      );
    }

    const roleUpper: string = String(user.role).trim().toUpperCase();
    if (roleUpper === "AGENT") {
      const sys = await getOrCreateSystemSettings(prisma);
      if (sys.isMaintenance) {
        log("fail: maintenance mode blocks agent login");
        return NextResponse.json<LoginErrorResponse>(
          {
            success: false,
            message: MAINTENANCE_BLOCK_AR,
            error: "MAINTENANCE_MODE",
          },
          { status: 403 }
        );
      }
    }

    log("step: credentials ok — routing deferred to client/middleware (applicationStatus in payload)");

    if (roleUpper === "AGENT") {
      await prisma.user
        .update({
          where: { id: user.id },
          data: { isOnline: true, lastSeen: new Date() },
        })
        .catch((e) => log("warn: failed to set agent online", { error: String(e) }));
      await prisma.agent
        .updateMany({
          where: { userId: user.id },
          data: { online: true },
        })
        .catch((e) => log("warn: failed to set Agent.online", { error: String(e) }));
    }

    const roleForToken: string = String(user.role).toLowerCase();

    // 1) Issue JWT only after all auth checks pass (must complete before attaching to the response).
    log("step: signing session token");
    const token: string = await signSessionToken({
      id: user.id,
      role: roleForToken,
      email: user.email,
      username: user.username,
      applicationStatus: user.applicationStatus,
    });
    log("step: session token created", { tokenLength: token.length });

    const roleU = String(user.role ?? "").trim().toUpperCase();
    const adminPermissions =
      roleU === "SUPER_ADMIN"
        ? [...ALL_PERMISSION_IDS]
        : roleU === "ADMIN"
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

    const appSt = String(user.applicationStatus ?? "")
      .trim()
      .toUpperCase();
    const userAcctSt = String(user.status ?? "").trim().toUpperCase();
    const redirectAfterLogin =
      appSt === "PENDING"
        ? "/pending"
        : roleForToken === "player" && userAcctSt === "PENDING_AGENT"
          ? "/player/choose-agent"
          : roleForToken === "player" && userAcctSt === "PENDING_APPROVAL"
            ? "/player/dashboard"
            : undefined;
    const payload: LoginSuccessResponse = {
      success: true,
      user: publicUser,
      ...(redirectAfterLogin ? { redirectAfterLogin } : {}),
    };

    // 2) `mobcash_user` via `cookies().set` from `next/headers` (App Router — merges with the route response).
    //    Payload: small JSON; `player` key matches Prisma (subset via {@link toMobcashUserCookiePayload}).
    //    `mobcash_session` stays on `NextResponse.cookies` (same effective Set-Cookie behavior).
    const sessionCookieMaxAgeSec = 60 * 60 * 24 * 7;
    const isProd = process.env.NODE_ENV === "production";
    const sessionCookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: isProd,
      path: "/",
      maxAge: sessionCookieMaxAgeSec,
    };
    const mobcashUserPayload = toMobcashUserCookiePayload(publicUser);
    const mobcashUserString = JSON.stringify(mobcashUserPayload);

    const cookieStore = await cookies();
    cookieStore.set("mobcash_user", mobcashUserString, {
      path: "/",
      maxAge: sessionCookieMaxAgeSec,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });

    const res = NextResponse.json(payload, { status: 200 });
    res.cookies.set("mobcash_session", token, sessionCookieOpts);

    log("step: cookies set on response", {
      mobcash_session: "res.cookies",
      mobcash_user: "next/headers cookies().set",
      mobcashUserJsonBytes: Buffer.byteLength(mobcashUserString, "utf8"),
      path: "/",
    });
    log("ok: login success, returning 200", { userId: user.id });

    return res;
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : String(error);
    const errName = error instanceof Error ? error.name : "Error";
    log("fail: unhandled exception (500)", { name: errName, message: errMsg });
    console.log("Login Error:", error);
    return NextResponse.json<LoginErrorResponse & { name?: string }>(
      {
        success: false,
        message: errMsg,
        name: errName,
        error: "LOGIN_EXCEPTION",
      },
      { status: 500 }
    );
  }
}
