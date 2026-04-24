import { NextResponse } from "next/server";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the current user (same shape as a successful `POST /api/login`, including `player`) from the session cookie
 * so client pages can hydrate `localStorage` when only httpOnly cookies exist.
 */
export async function GET() {
  try {
    const user: MobcashUser | null = await getSessionUserFromCookies();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }
    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json(
      { success: false, message: "Not authenticated" },
      { status: 401 }
    );
  }
}
