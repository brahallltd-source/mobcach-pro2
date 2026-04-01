import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function mapOrder(order: any) {
  return {
    ...order,
    gosport365_username: order.gosportUsername,
    payment_method_name: order.paymentMethodName,
    proof_url: order.proofUrl,
    review_reason: order.reviewReason,
    proof_duplicate_detected: Boolean(order.reviewReason?.includes("duplicate_proof_hash")),
    anti_fraud_state: order.reviewRequired ? "flagged" : "basic_pass",
    suspicious_flags: order.reviewReason ? [order.reviewReason] : [],
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    agent_approved: order.status === "agent_approved_waiting_player" || order.status === "completed",
    player_approved: order.status === "completed",
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

    const user = await prisma.user.findFirst({
      where: {
        email,
        role: "AGENT",
      },
    });

    if (!user?.agentId) {
      return NextResponse.json({ orders: [], order: null });
    }

    if (orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          agentId: user.agentId,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return NextResponse.json({
        order: order ? mapOrder(order) : null,
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        agentId: user.agentId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      orders: orders.map(mapOrder),
    });
  } catch (error) {
    console.error("AGENT ORDERS ERROR:", error);
    return NextResponse.json({ orders: [], order: null }, { status: 500 });
  }
}