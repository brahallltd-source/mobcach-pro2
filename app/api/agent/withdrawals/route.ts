import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1. جلب طلبات السحب الخاصة بالوكيل (للمراجعة)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!agentId || !prisma) {
      return NextResponse.json({ message: "agentId مطلوب", withdrawals: [] }, { status: 400 });
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: { agentId: String(agentId) },
      orderBy: { createdAt: "desc" },
    });

    // تنسيق البيانات للـ Frontend (Snake Case)
    const formatted = withdrawals.map((w) => ({
      ...w,
      created_at: w.createdAt,
      updated_at: w.updatedAt,
    }));

    return NextResponse.json({ withdrawals: formatted });
  } catch (error) {
    console.error("AGENT WITHDRAWALS GET ERROR:", error);
    return NextResponse.json({ message: "خطأ في جلب البيانات", withdrawals: [] }, { status: 500 });
  }
}

// 2. موافقة أو رفض طلب السحب من طرف الوكيل
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { withdrawalId, action, note } = await req.json();

    if (!withdrawalId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "البيانات المطلوبة غير كاملة" }, { status: 400 });
    }

    // أ. البحث عن الطلب والتأكد أنه مازال قيد الانتظار (pending)
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { player: { include: { user: { select: USER_SELECT_SAFE_RELATION } } } },
    });

    if (!withdrawal) {
      return NextResponse.json({ message: "طلب السحب غير موجود" }, { status: 404 });
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json({ message: "هذا الطلب تمت معالجته مسبقاً" }, { status: 400 });
    }

    // ب. تحديث الحالة فـ الداتابيز
    // ملاحظة: استعملنا "sent" للموافقة (بمعنى أرسلت للآدمين) و "rejected" للرفض
    const updatedStatus = action === "approve" ? "sent" : "rejected";

    const updatedWithdrawal = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: updatedStatus,
        adminNote: note || "", // استعملنا adminNote لتخزين ملاحظة الوكيل
        updatedAt: new Date(),
      },
    });

    // ج. نظام الإشعارات
    if (action === "approve") {
      // إشعار للآدمين باش يدير الفيرمان
      await createNotification({
        targetRole: "admin",
        targetId: "admin",
        title: "طلب سحب مؤكد من وكيل ✅",
        message: `الوكيل أكد طلب السحب الخاص بـ ${withdrawal.playerEmail}. المبلغ: ${withdrawal.amount} DH.`,
      });

      // إشعار للاعب
      await createNotification({
        targetRole: "player",
        targetId: withdrawal.player.userId,
        title: "تم تأكيد طلبك من الوكيل",
        message: "تمت الموافقة على طلبك، الإدارة الآن بصدد تحويل المبلغ إليك.",
      });
    } else {
      // إشعار للاعب فـ حالة الرفض
      await createNotification({
        targetRole: "player",
        targetId: withdrawal.player.userId,
        title: "تم رفض طلب السحب ❌",
        message: "نعتذر، تم رفض طلبك من طرف الوكيل. يرجى مراجعة التفاصيل والمحاولة مرة أخرى.",
      });
    }

    return NextResponse.json({ 
      success: true,
      message: action === "approve" ? "تم تأكيد الطلب وإرساله للإدارة" : "تم رفض الطلب بنجاح", 
      withdrawal: updatedWithdrawal 
    });

  } catch (error: any) {
    console.error("AGENT WITHDRAWALS POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة الطلب" }, { status: 500 });
  }
}