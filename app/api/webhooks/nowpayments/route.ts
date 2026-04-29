import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { createNotification } from "@/lib/notifications";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

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

    const paymentStatus = normalizeStatus(data.payment_status);
    if (paymentStatus === "finished" || paymentStatus === "paid") {
      const rechargeRequestId = String(data.order_id ?? "").trim();
      const providerPaymentId = String(
        data.payment_id ?? data.id ?? data.invoice_id ?? ""
      ).trim();
      if (!rechargeRequestId) {
        return NextResponse.json({ error: "Missing order_id in webhook payload" }, { status: 400 });
      }

      const txResult = await prisma.$transaction(async (tx) => {
        const requestRow = await tx.rechargeRequest.findUnique({
          where: { id: rechargeRequestId },
          select: {
            id: true,
            status: true,
            amount: true,
            agentId: true,
            nowPaymentsId: true,
          },
        });

        if (!requestRow) {
          return { kind: "not_found" as const };
        }

        const alreadyApproved =
          String(requestRow.status ?? "").trim().toUpperCase() === "APPROVED";
        if (alreadyApproved) {
          return { kind: "already_approved" as const };
        }

        const amountMad = Number(requestRow.amount);
        if (!Number.isFinite(amountMad) || amountMad <= 0) {
          throw new Error(`Invalid recharge amount for request ${requestRow.id}`);
        }

        const resolved = await resolveAgentWalletIds(tx, requestRow.agentId);
        if (!resolved) {
          throw new Error(`Agent not found for recharge request ${requestRow.id}`);
        }

        const wallet = await ensureAgentWallet(tx, resolved);
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amountMad } },
        });
        await tx.agent.update({
          where: { id: resolved.agentTableId },
          data: { availableBalance: Number(updatedWallet.balance || 0) },
        });

        await tx.walletLedger.create({
          data: {
            agentId: resolved.userId,
            walletId: wallet.id,
            type: "credit",
            amount: amountMad,
            reason: "nowpayments_auto_approved",
            meta: {
              rechargeRequestId: requestRow.id,
              nowPaymentsId: providerPaymentId || requestRow.nowPaymentsId || null,
              paymentStatus,
            },
          },
        });

        await tx.rechargeRequest.update({
          where: { id: requestRow.id },
          data: {
            status: "APPROVED",
            nowPaymentsId: providerPaymentId || requestRow.nowPaymentsId || null,
            updatedAt: new Date(),
          },
        });

        return {
          kind: "approved" as const,
          agentUserId: resolved.userId,
          amountMad,
        };
      });

      if (txResult.kind === "not_found" || txResult.kind === "already_approved") {
        return NextResponse.json({ received: true, state: txResult.kind });
      }

      await createNotification({
        userId: txResult.agentUserId,
        title: "NOWPayments Recharge Approved",
        message: "تم شحن رصيدك بنجاح عبر NOWPayments",
        type: "SUCCESS",
        link: "/agent/gosport365-topup?tab=history",
      });

      return NextResponse.json({
        received: true,
        state: "approved",
        amountMad: txResult.amountMad,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("NOWPayments webhook error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Secure Webhook Endpoint is Online" });
}