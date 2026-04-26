import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب كاع النزاعات
export async function GET() {
  try {
    const access = await requirePermission("VIEW_FINANCIALS");
    if (!access.ok) {
      return respondIfAdminAccessDenied(access, { disputes: [] });
    }

    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ disputes: [] }, { status: 500 });

    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: true // باش الآدمين يعرف المعلومات ديال الطلب ديريكت
      }
    });

    return NextResponse.json({ disputes });
  } catch (error) {
    console.error("GET DISPUTES ERROR:", error);
    return NextResponse.json({ disputes: [], message: "Error fetching data" }, { status: 500 });
  }
}

// 🔵 معالجة النزاع (حل أو رفض)
export async function POST(req: Request) {
  try {
    const access = await requirePermission("VIEW_FINANCIALS");
    if (!access.ok) {
      return respondIfAdminAccessDenied(access);
    }

    const prisma = getPrisma();
    const { disputeId, status, admin_note } = await req.json();

    if (!disputeId) {
      return NextResponse.json({ message: "disputeId is required" }, { status: 400 });
    }

    // 1. تنفيذ التحديث فـ Transaction
    const result = await prisma.$transaction(async (tx) => {
      // أ. تحديث حالة النزاع
      const updatedDispute = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: status || "resolved",
          adminNote: admin_note || "",
        },
      });

      // ب. إذا تحل النزاع، كنحيدو الـ Flag من الطلب (Order)
      if (updatedDispute.status === "resolved") {
        await tx.order.update({
          where: { id: updatedDispute.orderId },
          data: {
            reviewRequired: false,
            reviewReason: "",
          }
        });
      }

      return updatedDispute;
    });

    const playerUser = await prisma.user.findFirst({
      where: {
        email: result.playerEmail.trim().toLowerCase(),
        deletedAt: null,
        role: { equals: "PLAYER", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (playerUser) {
      await createNotification({
        userId: playerUser.id,
        title: "تحديث بخصوص النزاع",
        message: `تم تحديث حالة النزاع الخاص بالطلب ${result.orderId} من طرف الإدارة.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث النزاع بنجاح ✅",
      dispute: result,
    });
  } catch (error: any) {
    console.error("ADMIN DISPUTE POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة النزاع" }, { status: 500 });
  }
}