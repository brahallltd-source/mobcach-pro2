import { UserAccountStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { localizeNotificationMessage, localizeNotificationTitle } from "@/lib/constants/i18n";
import { sendPushNotification } from "@/lib/web-push";

type AppNotificationType = "INFO" | "RECHARGE_REQUEST" | "SUCCESS" | "ALERT";

async function activeAdminUserIds(): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  const admins = await prisma.user.findMany({
    where: {
      deletedAt: null,
      accountStatus: UserAccountStatus.ACTIVE,
      frozen: false,
      OR: [
        { role: { equals: "ADMIN", mode: "insensitive" } },
        { role: { equals: "SUPER_ADMIN", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** One in-app row per active admin (replaces legacy `targetRole: admin` + fake `targetId`). */
export async function notifyAllActiveAdmins(opts: {
  title: string;
  message: string;
  type?: AppNotificationType;
  link?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const ids = await activeAdminUserIds();
  const title = localizeNotificationTitle(opts.title);
  const message = localizeNotificationMessage(opts.message);
  const type = opts.type ?? "INFO";

  const link = opts.link ?? undefined;
  for (const id of ids) {
    await prisma.notification.create({
      data: {
        userId: id,
        targetRole: "ADMIN",
        targetId: id,
        title,
        message,
        type,
        link: opts.link ?? null,
        read: false,
      },
    });
    void sendPushNotification(id, {
      title,
      message,
      ...(link ? { url: link } : {}),
    });
  }
}

/** One in-app row per admin user (recipient `userId`) for recharge review. */
export async function notifyAllAdminsOfNewRechargeRequest(opts: {
  title: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const admins = await prisma.user.findMany({
    where: {
      deletedAt: null,
      accountStatus: UserAccountStatus.ACTIVE,
      frozen: false,
      OR: [
        { role: { equals: "ADMIN", mode: "insensitive" } },
        { role: { equals: "SUPER_ADMIN", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  const title = localizeNotificationTitle(opts.title);
  const message = localizeNotificationMessage(opts.message);
  const link = opts.link ?? undefined;
  for (const a of admins) {
    await prisma.notification.create({
      data: {
        userId: a.id,
        targetRole: "ADMIN",
        targetId: a.id,
        title,
        message,
        type: "RECHARGE_REQUEST",
        link: opts.link ?? null,
        read: false,
      },
    });
    void sendPushNotification(a.id, {
      title,
      message,
      ...(link ? { url: link } : {}),
    });
  }
}

/** One row per admin when someone applies to become an agent (pending activation). */
export async function notifyAllAdminsNewAgentApplication(opts: {
  applicantUsername: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const admins = await prisma.user.findMany({
    where: {
      deletedAt: null,
      accountStatus: UserAccountStatus.ACTIVE,
      frozen: false,
      OR: [
        { role: { equals: "ADMIN", mode: "insensitive" } },
        { role: { equals: "SUPER_ADMIN", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  const username = opts.applicantUsername.trim() || "—";
  const title = "طلب وكيل جديد";
  const message = `قام ${username} بالتسجيل كوكيل جديد وينتظر التفعيل.`;
  const link = "/admin/users";
  for (const a of admins) {
    await prisma.notification.create({
      data: {
        userId: a.id,
        targetRole: "ADMIN",
        targetId: a.id,
        title,
        message,
        type: "INFO",
        link,
        read: false,
      },
    });
    void sendPushNotification(a.id, { title, message, url: link });
  }
}

/** Notify the submitting agent (`User.id` === `RechargeRequest.agentId`) after admin decision. */
export async function notifyAgentRechargeDecision(opts: {
  agentUserId: string;
  title: string;
  message: string;
  type: AppNotificationType;
  link?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const title = localizeNotificationTitle(opts.title);
  const message = localizeNotificationMessage(opts.message);
  const link = opts.link ?? undefined;

  await prisma.notification.create({
    data: {
      userId: opts.agentUserId,
      targetRole: "AGENT",
      targetId: opts.agentUserId,
      title,
      message,
      type: opts.type,
      link: opts.link ?? null,
      read: false,
    },
  });

  void sendPushNotification(opts.agentUserId, {
    title,
    message,
    ...(link ? { url: link } : {}),
  });
}

/** One row per admin when an agent opens a support ticket. */
export async function notifyAllAdminsNewSupportTicket(opts: {
  agentUsername: string;
  subject: string;
  ticketId: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const admins = await prisma.user.findMany({
    where: {
      deletedAt: null,
      accountStatus: UserAccountStatus.ACTIVE,
      frozen: false,
      OR: [
        { role: { equals: "ADMIN", mode: "insensitive" } },
        { role: { equals: "SUPER_ADMIN", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  const who = opts.agentUsername.trim() || "وكيل";
  const subj = opts.subject.trim() || "—";
  const title = "تذكرة دعم جديدة";
  const message = `${who}: ${subj}`;
  const link = `/admin/support?ticket=${encodeURIComponent(opts.ticketId)}`;
  for (const a of admins) {
    await prisma.notification.create({
      data: {
        userId: a.id,
        targetRole: "ADMIN",
        targetId: a.id,
        title,
        message,
        type: "ALERT",
        link,
        read: false,
      },
    });
    void sendPushNotification(a.id, { title, message, url: link });
  }
}

/** Notify the agent after admin replies and closes the ticket. */
export async function notifyAgentSupportTicketReplied(opts: {
  agentUserId: string;
  subject: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const subj = opts.subject.trim() || "تذكرتك";
  const title = "رد الإدارة على تذكرة الدعم";
  const message = `تم الرد على: ${subj}. افتح صفحة الدعم لقراءة الرد الكامل.`;
  const link = "/agent/support";
  await prisma.notification.create({
    data: {
      userId: opts.agentUserId,
      targetRole: "AGENT",
      targetId: opts.agentUserId,
      title,
      message,
      type: "INFO",
      link,
      read: false,
    },
  });

  void sendPushNotification(opts.agentUserId, { title, message, url: link });
}
