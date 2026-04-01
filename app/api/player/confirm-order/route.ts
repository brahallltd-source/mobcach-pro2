import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.status !== "agent_approved_waiting_player") {
      return NextResponse.json({ message: "Order not ready for confirmation" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: String(orderId) },
      data: {
        status: "completed",
        updatedAt: new Date(),
      },
    });

    await createNotification({
      targetRole: "agent",
      targetId: order.agentId,
      title: "Order completed",
      message: `Order ${order.id} has been confirmed by the player.`,
    });

    return NextResponse.json({ message: "Order completed successfully ✅", order: updated });
  } catch (error: any) {
    console.error("CONFIRM ORDER ERROR:", error);
    return NextResponse.json({ message: error?.message || "Server error" }, { status: 500 });
  }
}