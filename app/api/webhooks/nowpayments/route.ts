import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-nowpayments-sig");
    const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
    const prisma = getPrisma();

    // 1. التحقق من الأمان (Signature Verification)
    if (!signature || !IPN_SECRET) {
      console.error("❌ Security credentials missing");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = JSON.parse(body);
    const hmac = crypto.createHmac("sha512", IPN_SECRET);
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    hmac.update(sortedData);
    const checkSignature = hmac.digest("hex");

    if (signature !== checkSignature) {
      console.warn("⚠️ Invalid Signature! Potential fake request.");
      return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
    }

    // 2. معالجة الطلب إذا كانت الحالة "finished"
    if (data.payment_status === "finished" || data.payment_status === "partially_paid") {
      const amount = Number(data.actually_paid);
      const agentId = data.order_id;

      // تحديث رصيد الوكيل
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: { availableBalance: { increment: amount } }
      });

      // جلب معلومات المستخدم للسجل
      const userData = await prisma.user.findUnique({
        where: { id: agentId },
        select: { email: true, username: true }
      });

      const emailToUse = userData?.email || "crypto-user@gs365.com";
      const usernameToUse = userData?.username || "CRYPTO_RECHARGE";

      // إنشاء سجل الطلب
      await prisma.order.create({
        data: {
          agentId: agentId,
          amount: amount,
          status: "COMPLETED",
          playerEmail: emailToUse,
          gosportUsername: usernameToUse
        }
      });

      // تنبيه للأدمن
      await createNotification({
        targetRole: "admin",
        targetId: "SYSTEM",
        title: "شحن تلقائي ناجح 💰",
        message: `تمت تعبئة ${amount} بنجاح للوكيل ${usernameToUse}.`
      });

      return NextResponse.json({ success: "Webook processed securely" });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("🔥 Webhook Error:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Secure Webhook Endpoint is Online" });
}