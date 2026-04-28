import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    if (!session || String(session.role || "").toUpperCase() !== "PLAYER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      action?: "confirm" | "flag";
      rating?: "like" | "dislike";
      comment?: string;
      reason?: string;
    };
    const orderId = String(body.orderId || "").trim();
    const action = String(body.action || "").trim().toLowerCase();
    const rating = String(body.rating || "").trim().toLowerCase();
    const comment = String(body.comment || "").trim();
    const reason = String(body.reason || "").trim();

    if (!orderId || (action !== "confirm" && action !== "flag")) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { agent: { select: { id: true, userId: true } } },
    });
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const sessionEmail = String(session.email || "").trim().toLowerCase();
    if (sessionEmail !== String(order.playerEmail || "").trim().toLowerCase()) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (order.status !== "agent_approved_waiting_player") {
      return NextResponse.json({ message: "Order is not ready for closing" }, { status: 400 });
    }

    if (action === "flag") {
      if (reason.length < 5) {
        return NextResponse.json({ message: "Flag reason is required" }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const upd = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "flagged_for_review",
            reviewRequired: true,
            reviewReason: reason,
          },
        });
        await tx.dispute.create({
          data: {
            orderId: order.id,
            playerEmail: order.playerEmail,
            reason,
            status: "pending",
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: order.id,
            senderRole: "player",
            message: `⚠️ Player flagged this order: ${reason}`,
          },
        });
        return upd;
      });

      const agentUserId = order.agent?.userId || (await getAgentUserIdByAgentProfileId(order.agentId));
      if (agentUserId) {
        await createNotification({
          userId: agentUserId,
          title: "Order flagged by player",
          message: `Order ${order.id.slice(0, 8)} was flagged for review.`,
        });
      }
      return NextResponse.json({ success: true, order: updated });
    }

    if (rating !== "like" && rating !== "dislike") {
      return NextResponse.json({ message: "Rating (like/dislike) is required" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id: order.id },
        data: { status: "completed", updatedAt: new Date() },
      });
      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "player",
          message: `✅ Player confirmed balance. Rating: ${rating}${comment ? ` | ${comment}` : ""}`,
        },
      });
      await tx.user.update({
        where: { id: order.agent.userId },
        data: rating === "like" ? { likes: { increment: 1 } } : { dislikes: { increment: 1 } },
      });
      return upd;
    });

    const agentUserId = order.agent?.userId || (await getAgentUserIdByAgentProfileId(order.agentId));
    if (agentUserId) {
      await createNotification({
        userId: agentUserId,
        title: "Order completed",
        message: `Player confirmed and closed order ${order.id.slice(0, 8)}.`,
      });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error("PLAYER CLOSE ORDER ERROR:", error);
    return NextResponse.json({ message: "Failed to close order" }, { status: 500 });
  }
}
