import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const { orderId, proof_url, proof_hash } = body;

    if (!orderId || !proof_url) {
      return NextResponse.json({ message: "Order ID and proof are required" }, { status: 400 });
    }

    // 1. فحص واش هاد الـ Hash ديجا مستعمل (Anti-Fraud)
    let isDuplicate = false;
    if (proof_hash) {
      const existingProof = await prisma.order.findFirst({
        where: {
          proofHash: proof_hash,
          id: { not: orderId } // ما يكونش هو نفس الطلب
        }
      });
      if (existingProof) isDuplicate = true;
    }

    // 2. تحديث الطلب فـ Transaction
    const result = await prisma.$transaction(async (tx) => {
      // أ. تحديث الطلب الأساسي
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          proofUrl: proof_url,
          proofHash: proof_hash,
          status: isDuplicate ? "flagged_for_review" : "proof_uploaded",
          reviewRequired: isDuplicate,
          reviewReason: isDuplicate ? "Duplicate proof hash detected" : null,
        },
      });

      // ب. تسجيل رسالة النظام فـ الشات
      await tx.orderMessage.create({
        data: {
          orderId: orderId,
          senderRole: "system",
          message: isDuplicate 
            ? "⚠️ Warning: Duplicate proof detected. System review required."
            : "Player has uploaded payment proof. Agent review required.",
        },
      });

      // ج. إذا كان تكرار، نزيدو Flag فـ جدول الـ FraudFlag
      if (isDuplicate) {
        await tx.fraudFlag.create({
          data: {
            orderId: orderId,
            type: "DUPLICATE_PROOF",
            score: 100,
            note: `This proof hash was already used in another order.`,
          }
        });
      }

      return order;
    });

    const agentUserId = await getAgentUserIdByAgentProfileId(result.agentId);
    if (agentUserId) {
      await createNotification({
        userId: agentUserId,
        title: isDuplicate ? "🚩 Duplicate Proof Detected" : "Proof Uploaded",
        message: isDuplicate
          ? `Order ${orderId.split("-")[0]} flagged for duplicate proof!`
          : `Player uploaded proof for order ${orderId.split("-")[0]}.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: isDuplicate ? "Order flagged for duplicate proof" : "Order updated and agent notified",
      order: result,
      flagged: isDuplicate
    });

  } catch (error: any) {
    console.error("UPDATE ORDER PROOF ERROR:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to update order status" }, { status: 500 });
  }
}