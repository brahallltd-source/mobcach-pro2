import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-nowpayments-sig");
    const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

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
      const externalAgentKey = String(data.order_id ?? "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || !externalAgentKey) {
        return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
      }

      const txResult = await prisma.$transaction(async (tx) => {
        const resolved = await resolveAgentWalletIds(tx, externalAgentKey);
        if (!resolved) throw new Error("Agent not found for webhook order_id");
        const wallet = await ensureAgentWallet(tx, resolved);

        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });
        await tx.agent.update({
          where: { id: resolved.agentTableId },
          data: { availableBalance: Number(updatedWallet.balance || 0) },
        });

        const userData = await tx.user.findUnique({
          where: { id: resolved.userId },
          select: { email: true, username: true },
        });

        const emailToUse = userData?.email || "crypto-user@gs365.com";
        const usernameToUse = userData?.username || "CRYPTO_RECHARGE";

        await tx.order.create({
          data: {
            agentId: resolved.agentTableId,
            amount,
            status: "completed",
            playerEmail: emailToUse,
            gosportUsername: usernameToUse,
          },
        });

        return { usernameToUse };
      });

      await notifyAllActiveAdmins({
        title: "شحن تلقائي ناجح 💰",
        message: `تمت تعبئة ${amount} بنجاح للوكيل ${txResult.usernameToUse}.`,
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