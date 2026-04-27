export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

function isPushSubscriptionJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.endpoint !== "string" || !o.endpoint.trim()) return false;
  const keys = o.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return false;
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === "string" && typeof k.auth === "string";
}

/**
 * Saves `PushSubscription.toJSON()` for the signed-in user (overwrites previous device).
 */
export async function POST(req: Request) {
  const user = await getSessionUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const subscription = record.subscription ?? record;

  if (!isPushSubscriptionJson(subscription)) {
    return NextResponse.json(
      { success: false, message: "Invalid PushSubscription: expected endpoint and keys.p256dh, keys.auth" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: subscription as Prisma.InputJsonValue },
  });

  const ep = (subscription as { endpoint?: string }).endpoint;
  console.log("[web-push/subscribe] Saved push subscription for user:", user.id, {
    role: user.role,
    endpointHost: ep ? (() => { try { return new URL(ep).host; } catch { return "invalid-endpoint"; } })() : "none",
  });

  return NextResponse.json({ success: true });
}
