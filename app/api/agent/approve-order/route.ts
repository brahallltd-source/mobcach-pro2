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

    if (!["proof_uploaded", "pending"].includes(order.status)) {
      return NextResponse.json({ message: "Order must be in proof_uploaded or pending state" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: String(orderId) },
      data: {
        status: "agent_approved_waiting_player",
        updatedAt: new Date(),
      },
    });

    const playerUser = await prisma.user.findFirst({ where: { email: order.playerEmail, role: "PLAYER" } });
    if (playerUser) {
      await createNotification({
        targetRole: "player",
        targetId: playerUser.id,
        title: "Order approved",
        message: `Your agent approved order ${order.id}.`,
      });
    }

    return NextResponse.json({
      message: "Order approved successfully ✅",
      order: {
        ...updated,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
