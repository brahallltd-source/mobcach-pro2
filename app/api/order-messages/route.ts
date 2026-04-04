import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function mapMessage(msg: any) {
  return {
    id: msg.id,
    senderRole: msg.senderRole,
    message: msg.message,
    created_at: msg.createdAt,
  };
}

function mapOrder(order: any) {
  return {
    id: order.id,
    agentId: order.agentId,
    playerId: order.playerId || undefined,
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
    created_at: order.createdAt,
    createdAt: order.createdAt,
    updated_at: order.updatedAt,
    updatedAt: order.updatedAt,
    messages: (order.messages || []).map(mapMessage),
  };
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ order: null, messages: [] });
    }

    const { searchParams } = new URL(req.url);
    const orderId = String(searchParams.get("orderId") || "").trim();

    if (!orderId) {
      return NextResponse.json(
        { message: "orderId is required", order: null, messages: [] },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Order not found", order: null, messages: [] },
        { status: 404 }
      );
    }

    const mapped = mapOrder(order);
    return NextResponse.json({ order: mapped, messages: mapped.messages || [] });
  } catch (error) {
    console.error("GET ORDER MESSAGES ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`,, order: null, messages: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const orderId = String(body.orderId || "").trim();
    const senderRole = String(body.senderRole || "").trim();
    const message = String(body.message || "").trim();

    if (!orderId || !senderRole || !message) {
      return NextResponse.json(
        { message: "orderId, senderRole and message are required" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
    }

    const created = await prisma.orderMessage.create({
      data: {
        orderId,
        senderRole,
        message,
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      item: {
        id: created.id,
        senderRole: created.senderRole,
        message: created.message,
        created_at: created.createdAt,
      },
    });
  } catch (error) {
    console.error("POST ORDER MESSAGES ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}
