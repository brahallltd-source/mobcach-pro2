import type { PrismaClient } from "@prisma/client";

/** Shared resolve/reopen logic for fraud center (used by `/api/admin/fraud` POST and `/api/admin/fraud-review`). */
export async function applyFraudFlagOrderAction(
  prisma: PrismaClient,
  opts: { orderId: string; action: "resolve" | "reopen" | "force_approve" | "reject"; note?: string | null }
) {
  const { orderId, action, note } = opts;
  const noteStr = note != null && String(note).trim() ? String(note).trim() : undefined;

  const latestFlag = await prisma.fraudFlag.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return prisma.$transaction(async (tx) => {
    if (action === "resolve" || action === "force_approve") {
      if (latestFlag) {
        await tx.fraudFlag.update({
          where: { id: latestFlag.id },
          data: {
            resolved: true,
            note: `[تم القبول الإجباري بواسطة الإدارة]: ${noteStr ?? "لا توجد ملاحظة"}`,
          },
        });
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "agent_approved_waiting_player",
          isFlagged: false,
          reviewRequired: false,
          reviewReason: noteStr || "Force approved by admin fraud center",
          updatedAt: new Date(),
        },
      });
      await tx.orderMessage.create({
        data: {
          orderId,
          senderRole: "system",
          message: `✅ Admin force-approved this flagged request. ${noteStr ? `Note: ${noteStr}` : ""}`.trim(),
        },
      });
      return updated;
    }

    if (action === "reject") {
      if (latestFlag) {
        await tx.fraudFlag.update({
          where: { id: latestFlag.id },
          data: {
            resolved: true,
            note: `[تم الرفض بواسطة الإدارة]: ${noteStr ?? "لا توجد ملاحظة"}`,
          },
        });
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "cancelled",
          isFlagged: false,
          reviewRequired: false,
          reviewReason: noteStr || "Rejected by admin fraud center",
          updatedAt: new Date(),
        },
      });
      await tx.orderMessage.create({
        data: {
          orderId,
          senderRole: "system",
          message: `❌ Admin rejected this flagged request. ${noteStr ? `Reason: ${noteStr}` : ""}`.trim(),
        },
      });
      return updated;
    }

    if (action === "reopen") {
      if (latestFlag) {
        await tx.fraudFlag.update({
          where: { id: latestFlag.id },
          data: {
            resolved: false,
            note: `[إعادة فتح البلاغ]: ${noteStr ?? "لا توجد ملاحظة"}`,
          },
        });
      }
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "flagged_for_review",
          reviewRequired: true,
          reviewReason: noteStr || "Reopened by admin fraud center",
          updatedAt: new Date(),
        },
      });
    }

    throw new Error("Invalid action");
  });
}
