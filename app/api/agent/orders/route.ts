import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

function mapOrder(order: any) {
  return {
    id: order.id,
    amount: Number(order.amount || 0),
    status: order.status,
    playerEmail: order.playerEmail,
    gosport365_username: order.gosportUsername || "",
    payment_method_name: order.paymentMethodName || "",
    proof_url: order.proofUrl || null,
    review_reason: order.reviewReason || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    agent_approved:
      order.status === "agent_approved_waiting_player" ||
      order.status === "completed",
    player_approved: order.status === "completed",
    messages: (order.messages || []).map((msg: any) => ({
      id: msg.id,
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
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();
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

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const { email, orderId, action, reason } = await req.json();

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanOrderId = String(orderId || "").trim();

    if (!cleanEmail || !cleanOrderId || !action) {
      return NextResponse.json(
        { message: "email, orderId and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(String(action))) {
      return NextResponse.json(
        { message: "Invalid action" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        role: "AGENT",
      },
    });

    if (!user?.agentId) {
      return NextResponse.json(
        { message: "Agent account not found" },
        { status: 404 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: cleanOrderId,
        agentId: user.agentId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
    }

    if (String(action) === "approve") {
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "agent_approved_waiting_player",
        },
      });

      await prisma.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: "Agent approved the order. Waiting for player final confirmation.",
        },
      });

      return NextResponse.json({
        message: "Order approved successfully",
        order: mapOrder({
          ...updated,
          messages: [],
        }),
      });
    }

    const rejectReason = String(reason || "Rejected by agent").trim();

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "cancelled",
        reviewReason: rejectReason,
      },
    });

    await prisma.orderMessage.create({
      data: {
        orderId: order.id,
        senderRole: "system",
        message: `Agent rejected the order. Reason: ${rejectReason}`,
      },
    });

    try {
      const playerUser = await prisma.user.findFirst({
        where: {
          email: order.playerEmail.trim().toLowerCase(),
          deletedAt: null,
          role: { equals: "PLAYER", mode: "insensitive" },
        },
        select: { id: true },
      });
      if (playerUser) {
        await createNotification({
          userId: playerUser.id,
          title: "Your order was rejected",
          message: `Your order was rejected. Reason: ${rejectReason}`,
          type: "ALERT",
          link: "/player/orders",
        });
      }
    } catch (e) {
      console.warn("Order reject notification:", e);
    }

    return NextResponse.json({
      message: "Order rejected successfully",
      order: mapOrder({
        ...updated,
        messages: [],
      }),
    });
  } catch (error) {
    console.error("AGENT ORDER ACTION ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}