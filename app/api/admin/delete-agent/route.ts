import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });

    // 1. فحص وجود الوكيل
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: { select: USER_SELECT_SAFE_RELATION } },
    });

    if (!agent) {
      return NextResponse.json({ message: "الوكيل غير موجود" }, { status: 404 });
    }

    // 2. تنفيذ عملية المسح والتنظيف في Transaction واحدة لضمان السلامة
    await prisma.$transaction(async (tx) => {
      
      // أ. تحرير اللاعبين المربوطين (ردهم Inactive وحيد ليهم الـ Agent)
      await tx.player.updateMany({
        where: { assignedAgentId: agentId },
        data: {
          assignedAgentId: null,
          status: "inactive"
        }
      });

      // ب. التعامل مع الطلبات (Orders) التي لم تكتمل
      // الطلبات المكتملة كتبقى للتاريخ، والطلبات الجارية كتسينيالاو (Flagged)
      await tx.order.updateMany({
        where: {
          agentId: agentId,
          status: { not: "completed" }
        },
        data: {
          status: "flagged_for_review",
          reviewRequired: true
        }
      });

      // ج. مسح اليوزر (بما أن العلاقة فيها onDelete: Cascade، المسح غايقيس الـ Agent والـ Wallet والـ PaymentMethods أوتوماتيكياً)
      await tx.user.delete({
        where: { id: agent.userId }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم حذف الوكيل بنجاح وتنظيف كافة البيانات المرتبطة ✅" 
    });

  } catch (error: any) {
    console.error("DELETE AGENT ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة حذف الوكيل، قد يكون مرتبطاً ببيانات لا يمكن حذفها." 
    }, { status: 500 });
  }
}