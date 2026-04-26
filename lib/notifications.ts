import { getPrisma } from "@/lib/db";
import { localizeNotificationMessage, localizeNotificationTitle } from "@/lib/constants/i18n";
import { sendPushNotification } from "@/lib/web-push";

type AppNotificationType = "INFO" | "RECHARGE_REQUEST" | "SUCCESS" | "ALERT";

function normalizeTargetRole(role: string): string {
  const r = String(role || "PLAYER").trim().toUpperCase();
  if (r === "ADMIN" || r === "SUPER_ADMIN") return "ADMIN";
  if (r === "AGENT") return "AGENT";
  return "PLAYER";
}

/** `Order` / `Withdrawal` / marketplace fields use `Agent.id` (profile). Maps to the agent's `User.id`. */
export async function getAgentUserIdByAgentProfileId(agentProfileId: string): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const row = await prisma.agent.findUnique({
    where: { id: agentProfileId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

/**
 * Persist one in-app notification for a recipient `User`.
 * Always sets `userId` and aligns `targetRole` / `targetId` with that user.
 */
export async function createNotification(payload: {
  userId: string;
  title: string;
  message: string;
  type?: AppNotificationType;
  link?: string | null;
}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) return null;

  const title = localizeNotificationTitle(payload.title);
  const message = localizeNotificationMessage(payload.message);
  const targetRole = normalizeTargetRole(String(user.role));

  const created = await prisma.notification.create({
    data: {
      title,
      message,
      read: false,
      userId: user.id,
      targetRole,
      targetId: user.id,
      type: payload.type ?? "INFO",
      link: payload.link ?? null,
    },
  });

  const link = payload.link ?? undefined;
  void sendPushNotification(user.id, {
    title,
    message,
    ...(link ? { url: link } : {}),
  });

  return created;
}
