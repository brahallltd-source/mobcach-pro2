import { getPrisma } from "@/lib/db";

export async function createNotification(payload: {
  userId?: string;
  targetRole: string;
  targetId: string;
  title: string;
  message: string;
}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  return prisma.notification.create({
    data: {
      userId: payload.userId || null,
      targetRole: payload.targetRole,
      targetId: String(payload.targetId),
      title: payload.title,
      message: payload.message,
      read: false,
    },
  });
}
