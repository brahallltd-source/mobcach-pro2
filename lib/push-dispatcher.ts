import { getPrisma } from "@/lib/db";
import { getFirebaseMessaging } from "@/lib/firebase-admin";
import { sendPushNotification } from "@/lib/web-push";

const ANDROID_CHANNEL_ID = "gs365-high-priority";

export type UnifiedPushPayload = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
};

function toDataMap(payload: UnifiedPushPayload): Record<string, string> {
  const data: Record<string, string> = {};
  if (payload.url) data.url = payload.url;
  for (const [k, v] of Object.entries(payload.data ?? {})) {
    data[String(k)] = String(v);
  }
  return data;
}

export async function dispatchUnifiedPush(payload: UnifiedPushPayload): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      pushSubscription: true,
      nativePushDevices: {
        where: { enabled: true },
        select: { id: true, token: true, platform: true },
      },
    },
  });

  if (!user) return;

  // Web Push path (existing VAPID logic).
  if (user.pushSubscription != null) {
    try {
      await sendPushNotification(user.id, {
        title: payload.title,
        message: payload.body,
        ...(payload.url ? { url: payload.url } : {}),
      });
    } catch (e) {
      console.error("[push-dispatcher] web push failed:", e);
    }
  }

  // Native FCM path (Capacitor Android/iOS devices).
  const nativeTokens = user.nativePushDevices
    .map((d) => String(d.token || "").trim())
    .filter(Boolean);

  if (nativeTokens.length === 0) return;

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.error(
      "[push-dispatcher] Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
    );
    return;
  }

  const dataMap = toDataMap(payload);
  await Promise.all(
    nativeTokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: dataMap,
          android: {
            priority: "high",
            notification: {
              channelId: ANDROID_CHANNEL_ID,
              sound: "default",
              defaultSound: true,
              defaultVibrateTimings: true,
            },
          },
        });
      } catch (e) {
        const code = String((e as { code?: string })?.code ?? "");
        // Invalid/unregistered token -> soft disable to reduce repeated failures.
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          await prisma.nativePushDevice.updateMany({
            where: { token },
            data: { enabled: false },
          });
        }
        console.error("[push-dispatcher] native push failed:", { tokenSuffix: token.slice(-10), code, e });
      }
    })
  );
}
