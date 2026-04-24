import type { PrismaClient } from "@prisma/client";

/** Shared resolve/reopen logic for fraud center (used by `/api/admin/fraud` POST and `/api/admin/fraud-review`). */
export async function applyFraudFlagOrderAction(
  prisma: PrismaClient,
  opts: { orderId: string; action: "resolve" | "reopen"; note?: string | null }
) {
  const { orderId, action, note } = opts;
  const noteStr = note != null && String(note).trim() ? String(note).trim() : undefined;

  const latestFlag = await prisma.fraudFlag.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return prisma.$transaction(async (tx) => {
    if (action === "resolve") {
      if (latestFlag) {
        await tx.fraudFlag.update({
          where: { id: latestFlag.id },
          data: {
            resolved: true,
            note: `[تم الحل بواسطة الإدارة]: ${noteStr ?? "لا توجد ملاحظة"}`,
          },
        });
      }
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "proof_uploaded",
          reviewRequired: false,
          reviewReason: noteStr || "Resolved by admin fraud center",
          updatedAt: new Date(),
        },
      });
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
