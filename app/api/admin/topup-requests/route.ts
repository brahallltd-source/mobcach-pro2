import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    const requests = await prisma?.rechargeRequest.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    return NextResponse.json({ requests: [] });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ success: false }, { status: 500 });

    const { requestId, action } = await req.json();

    if (!requestId || !action) {
      return NextResponse.json({ success: false, message: "Missing data" }, { status: 400 });
    }

    // 1. أولاً نجلب الطلب لنتأكد من وجوده ونجلب المبلغ (amount) و (agentId)
    const existingRequest = await prisma.rechargeRequest.findUnique({
      where: { id: String(requestId) }
    });

    if (!existingRequest) {
      return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    }

    // تأكد أن الطلب مازال معلقاً لمنع إضافة الرصيد مرتين
    if (existingRequest.status !== "pending") {
      return NextResponse.json({ success: false, message: "تمت معالجة هذا الطلب مسبقاً" }, { status: 400 });
    }

    if (action === "approve") {
      // 2. استخدام Transaction لضمان تحديث حالة الطلب وإضافة الرصيد في نفس الوقت
      const [updatedRequest, updatedWallet] = await prisma.$transaction([
        // أ. تحديث حالة الطلب
        prisma.rechargeRequest.update({
          where: { id: String(requestId) },
          data: { status: "approved", updatedAt: new Date() }
        }),
        // ب. إضافة الرصيد لمحفظة الوكيل (أو إنشاء محفظة إذا لم تكن موجودة)
        prisma.wallet.upsert({
          where: { agentId: existingRequest.agentId },
          update: { 
            balance: { increment: existingRequest.amount }, // 🟢 هنا تتم زيادة الرصيد
            updatedAt: new Date() 
          },
          create: {
            agentId: existingRequest.agentId,
            userId: existingRequest.agentId,
            balance: existingRequest.amount
          } as any
        })
      ]);

      return NextResponse.json({ success: true, request: updatedRequest, balance: updatedWallet.balance });
      
    } else if (action === "reject") {
      // في حالة الرفض، نقوم فقط بتغيير الحالة دون المساس بالرصيد
      const updatedRequest = await prisma.rechargeRequest.update({
        where: { id: String(requestId) },
        data: { status: "rejected", updatedAt: new Date() }
      });
      return NextResponse.json({ success: true, request: updatedRequest });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("ADMIN ACTION ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}