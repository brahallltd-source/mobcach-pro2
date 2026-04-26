import webpush, { type PushSubscription as WebPushSubscriptionJson } from "web-push";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export type PushPayload = {
  title: string;
  message: string;
  /** Relative path (e.g. `/player/dashboard`) or absolute URL to open on click. */
  url?: string;
};

function getVapidSubject(): string {
  const s = process.env.VAPID_SUBJECT?.trim();
  if (s && (s.startsWith("mailto:") || s.startsWith("https:"))) return s;
  if (s?.includes("@")) return s.startsWith("mailto:") ? s : `mailto:${s}`;
  const legacy = process.env.VAPID_MAILTO?.trim();
  if (legacy?.startsWith("mailto:")) return legacy;
  if (legacy?.includes("@")) return `mailto:${legacy}`;
  return "mailto:noreply@localhost";
}

let vapidConfigured = false;

function tryConfigureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch {
    return false;
  }
}

function isPushSubscriptionJson(value: unknown): value is WebPushSubscriptionJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.endpoint !== "string" || !o.endpoint) return false;
  const keys = o.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return false;
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === "string" && typeof k.auth === "string";
}

/** Normalize `User.pushSubscription`: one object, or an array for multiple devices. */
function normalizePushSubscriptions(raw: unknown): WebPushSubscriptionJson[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is WebPushSubscriptionJson => isPushSubscriptionJson(x));
  }
  if (isPushSubscriptionJson(raw)) return [raw];
  return [];
}

function httpStatusFromWebPushError(err: unknown): number {
  if (typeof err !== "object" || !err) return 0;
  if ("statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
    return (err as { statusCode: number }).statusCode;
  }
  return 0;
}

function serializeSubscriptionsForDb(
  subs: WebPushSubscriptionJson[],
): Prisma.InputJsonValue | null {
  if (subs.length === 0) return null;
  if (subs.length === 1) return subs[0] as unknown as Prisma.InputJsonValue;
  return subs as unknown as Prisma.InputJsonValue;
}

/**
 * Sends Web Push to the user's stored subscription(s), if any. Never throws.
 * Missing VAPID env, missing DB, missing subscription, or send errors are swallowed
 * (expired subscriptions are cleared when the push endpoint returns 404/410).
 */
export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!tryConfigureVapid()) return;

    const prisma = getPrisma();
    if (!prisma) return;

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true },
    });

    const subs = normalizePushSubscriptions(row?.pushSubscription);
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      message: payload.message,
      url: payload.url ?? "/",
    });

    const retained: WebPushSubscriptionJson[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, body, { TTL: 60 * 60 });
        retained.push(sub);
      } catch (err: unknown) {
        const sc = httpStatusFromWebPushError(err);
        if (sc === 404 || sc === 410) {
          continue;
        }
        retained.push(sub);
      }
    }

    if (retained.length !== subs.length) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { pushSubscription: serializeSubscriptionsForDb(retained) },
        });
      } catch {
        // ignore persistence failures
      }
    }
  } catch {
    // never throw to callers
  }
}
