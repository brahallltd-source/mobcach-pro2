import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function mapOrder(order: any) {
  return {
    id: order.id,
    agentId: order.agentId,
    playerEmail: order.playerEmail,
    amount: order.amount,
    gosport365_username: order.gosportUsername,
    gosportUsername: order.gosportUsername,
    status: order.status,
    payment_method_name: order.paymentMethodName || undefined,
    paymentMethodName: order.paymentMethodName || undefined,
    proof_url: order.proofUrl || undefined,
    proofUrl: order.proofUrl || undefined,
    review_reason: order.reviewReason || undefined,
    reviewReason: order.reviewReason || undefined,
    wallet_deducted: order.walletDeducted,
    created_at: order.createdAt,
    createdAt: order.createdAt,
    updated_at: order.updatedAt,
    updatedAt: order.updatedAt,
    messages: (order.messages || []).map((msg: any) => ({
      senderRole: msg.senderRole,
      message: msg.message,
      created_at: msg.createdAt,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ orders: [], order: null });
    }

    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get("email") || "").trim().toLowerCase();
    const orderId = String(searchParams.get("orderId") || "").trim();

    if (!email) {
      return NextResponse.json({ orders: [], order: null });
    }

    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, playerEmail: email },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json({ order: order ? mapOrder(order) : null });
    }

    const orders = await prisma.order.findMany({
      where: { playerEmail: email },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders: orders.map(mapOrder) });
  } catch (error) {
    console.error("PLAYER ORDERS ERROR:", error);
    return NextResponse.json({ orders: [], order: null }, { status: 500 });
  }
}
