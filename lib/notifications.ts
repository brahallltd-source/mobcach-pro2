import { getPrisma } from "@/lib/db";
import { localizeNotificationMessage, localizeNotificationTitle } from "@/lib/constants/i18n";

type AppNotificationType = "INFO" | "RECHARGE_REQUEST" | "SUCCESS" | "ALERT";

export async function createNotification(payload: {
  targetRole: string;
  targetId: string;
  title: string;
  message: string;
  userId?: string | null;
  type?: AppNotificationType;
  link?: string | null;
}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const title = localizeNotificationTitle(payload.title);
  const message = localizeNotificationMessage(payload.message);

  return prisma.notification.create({
    data: {
      title,
      message,
      read: false,
      targetRole: payload.targetRole,
      targetId: String(payload.targetId),
      userId: payload.userId ?? null,
      type: payload.type ?? "INFO",
      link: payload.link ?? null,
    },
  });
}
