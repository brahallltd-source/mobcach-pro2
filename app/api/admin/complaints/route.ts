import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب جميع الشكايات
export async function GET() {
  try {
    const access = await requirePermission("VIEW_FINANCIALS");
    if (!access.ok) {
      return respondIfAdminAccessDenied(access, { complaints: [] });
    }

    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ complaints: [] }, { status: 500 });

    const complaints = await prisma.complaint.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ complaints });
  } catch (error) {
    console.error("GET COMPLAINTS ERROR:", error);
    return NextResponse.json({ complaints: [], message: "Error fetching data" }, { status: 500 });
  }
}

// 🔵 الرد على الشكاية وحلها
export async function POST(req: Request) {
  try {
    const access = await requirePermission("SUPPORT_TICKETS");
    if (!access.ok) {
      return respondIfAdminAccessDenied(access);
    }

    const prisma = getPrisma();
    const { complaintId, admin_reply } = await req.json();

    if (!complaintId || !admin_reply) {
      return NextResponse.json({ message: "complaintId and admin_reply are required" }, { status: 400 });
    }

    // 1. تحديث الشكاية فـ الداتابيز
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        adminReply: String(admin_reply).trim(),
        status: "resolved",
      },
    });

    // 2. إرسال إشعار للاعب
    // ملاحظة: كنستعملو الإيميل كـ targetId كيف كان عندك فـ الكود القديم
    await createNotification({
      targetRole: "player",
      targetId: updatedComplaint.playerEmail,
      title: "تم الرد على شكواك",
      message: `قام الإدارة بالرد على موضوع: ${updatedComplaint.subject}.`,
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال الرد بنجاح ✅",
      complaint: updatedComplaint,
    });
  } catch (error: any) {
    console.error("ADMIN COMPLAINT POST ERROR:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ message: "الشكاية غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة الرد" }, { status: 500 });
  }
}