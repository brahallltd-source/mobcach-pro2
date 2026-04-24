import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";

/** Aligned with `middleware.ts` `SESSION_COOKIE_NAMES` + `MOBCASH_USER_COOKIE` */
const AUTH_COOKIE_NAMES = [
  "mobcash_session",
  "token",
  "auth_token",
  "mobcash_token",
  "mobcash_user",
] as const;

function clearAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    path: "/" as const,
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
  };
}

export async function POST() {
  try {
    const session = await getSessionUserFromCookies();
    const prisma = getPrisma();
    if (session && prisma) {
      await prisma.user
        .update({
          where: { id: session.id },
          data: { isOnline: false, lastSeen: new Date() },
        })
        .catch(() => {});
      if (String(session.role ?? "").trim().toUpperCase() === "AGENT") {
        await prisma.agent.updateMany({
          where: { userId: session.id },
          data: { online: false },
        });
      }
    }
  } catch {
    /* ignore presence errors */
  }

  const res = NextResponse.json({ message: "Logged out" });
  const clearOpts = clearAuthCookieOptions();
  for (const name of AUTH_COOKIE_NAMES) {
    res.cookies.set(name, "", clearOpts);
  }
  return res;
}
