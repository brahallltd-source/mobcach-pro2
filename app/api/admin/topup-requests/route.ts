import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma"; // تأكد من وجود ملف Prisma client
import { creditWallet } from "@/lib/wallet"; // سنفترض أنك قمت بتحويل هذا الملف أيضاً لـ Prisma
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

// 1. جلب كافة الطلبات مع بيانات الوكيل (Username)
export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const requests = await prisma.rechargeRequest.findMany({
      include: {
        agent: {
          select: {
            username: true, // ✅ جلب الـ Username
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching data", requests: [] }, { status: 500 });
  }
}

    // تحويل البيانات لتناسب الواجهة (Flattening)
    const formattedRequests = requests.map((req) => ({
      ...req,
      agentUsername: req.agent?.username || req.agent?.email.split("@")[0],
      agentEmail: req.agent?.email,
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error("GET ADMIN TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ message: "خطأ في جلب الطلبات من قاعدة البيانات", requests: [] }, { status: 500 });
  }
}

// 2. معالجة الطلبات (موافقة أو رفض)
export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { requestId, action, adminEmail, transfer_reference, admin_note } = await req.json();

    if (!requestId || !action) {
      return NextResponse.json({ message: "requestId and action are required" }, { status: 400 });
    }

    // البحث عن الطلب في Prisma
    const requestRow = await prisma.topupRequest.findUnique({
      where: { id: requestId },
    });

    if (!requestRow) return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    if (requestRow.status !== "pending") return NextResponse.json({ message: "الطلب تمت معالجته مسبقاً" }, { status: 400 });

    let updatedRequest;

    if (action === "approve") {
      const baseAmount = Number(requestRow.amount);
      const bonusAmount = Math.floor(baseAmount * 0.1);

      // استخدام Transaction لضمان تنفيذ كافة العمليات أو فشلها معاً
      updatedRequest = await prisma.$transaction(async (tx) => {
        // تحديث الرصيد (سنستخدم دالة مساعدة أو تحديث مباشر)
        await tx.user.update({
          where: { id: requestRow.agentId },
          data: { balance: { increment: baseAmount + bonusAmount } },
        });

        // تطبيق البونص المعلق (Bonus logic)
        // ملاحظة: قد تحتاج لتعديل دالة applyPendingBonuses لتقبل الـ tx الخاص ببريزما
        const pendingApplied = await applyPendingBonusesToRecharge(requestRow.agentId, adminEmail);

        // تحديث حالة الطلب
        return await tx.topupRequest.update({
          where: { id: requestId },
          data: {
            status: "approved",
            bonus_amount: bonusAmount,
            pendingBonusApplied: pendingApplied.totalApplied,
            transfer_reference: String(transfer_reference || ""),
            admin_note: String(admin_note || ""),
            updated_at: new Date(),
          },
        });
      });

      // إرسال إشعار للوكيل
      await createNotification({
        targetRole: "agent",
        targetId: requestRow.agentId,
        title: "تمت الموافقة على شحن رصيدك",
        message: `تم تفعيل شحن ${requestRow.amount} DH. أضيفت لك مكافأة 10% (${bonusAmount} DH).`,
      });

    } else if (action === "reject") {
      updatedRequest = await prisma.topupRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          transfer_reference: String(transfer_reference || ""),
          admin_note: String(admin_note || ""),
          updated_at: new Date(),
        },
      });

      await createNotification({
        targetRole: "agent",
        targetId: requestRow.agentId,
        title: "تم رفض طلب الشحن",
        message: `تم رفض طلب الشحن الخاص بك بقيمة ${requestRow.amount} DH من قبل الإدارة.`,
      });
    }

    return NextResponse.json({ message: `تمت الـ ${action} بنجاح`, request: updatedRequest });

  } catch (error) {
    console.error("PROCESS ADMIN TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة العملية برمجياً" }, { status: 500 });
  }
}