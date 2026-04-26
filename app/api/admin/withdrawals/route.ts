import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

function mapWithdrawal(item: any) {
  return {
    id: item.id,
    playerId: item.playerId,
    playerEmail: item.playerEmail,
    agentId: item.agentId,
    amount: Number(item.amount || 0),
    method: item.method,
    status: item.status,
    rib: item.rib || null,
    swift: item.swift || null,
    cashProvider: item.cashProvider || null,
    fullName: item.fullName || null,
    phone: item.phone || null,
    city: item.city || null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    kind: item.kind || "standard",
    gosportUsername: item.gosportUsername || null,
    winnerOrderId: item.winnerOrderId || null,
    adminNote: item.adminNote || null,
  };
}

export async function GET() {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { withdrawals: [] });
    }

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available", withdrawals: [] },
        { status: 500 }
      );
    }

    const withdrawals = await prisma.withdrawal.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      withdrawals: withdrawals.map(mapWithdrawal),
    });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS GET ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, withdrawals: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("VIEW_FINANCIALS");

  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const { withdrawalId, action, note } = await req.json();

    if (!withdrawalId || !["mark_sent", "reject", "complete"].includes(action)) {
      return NextResponse.json(
        { message: "withdrawalId and valid action are required" },
        { status: 400 }
      );
    }

    const current = await prisma.withdrawal.findUnique({
      where: { id: String(withdrawalId) },
    });

    if (!current) {
      return NextResponse.json(
        { message: "Withdrawal request not found" },
        { status: 404 }
      );
    }

    const nextStatus =
      action === "mark_sent"
        ? "sent"
        : action === "complete"
        ? "completed"
        : "rejected";

    const updated = await prisma.withdrawal.update({
      where: { id: String(withdrawalId) },
      data: {
        status: nextStatus,
        adminNote: String(note || "").trim() || current.adminNote,
      },
    });

    const playerUser = await prisma.user.findFirst({
      where: {
        email: current.playerEmail,
        role: "PLAYER",
      },
    });

    if (playerUser?.id) {
      await createNotification({
        userId: playerUser.id,
        title:
          nextStatus === "rejected"
            ? "Payout rejected"
            : nextStatus === "completed"
            ? "Payout completed"
            : "Payout sent",
        message:
          nextStatus === "rejected"
            ? "Your payout request was rejected by admin."
            : nextStatus === "completed"
            ? `Your payout of ${updated.amount} DH has been completed.`
            : `Your payout of ${updated.amount} DH has been sent.`,
      });
    }

    return NextResponse.json({
      message:
        nextStatus === "rejected"
          ? "Withdrawal rejected by admin"
          : nextStatus === "completed"
          ? "Withdrawal completed successfully"
          : "Funds marked as sent",
      withdrawal: mapWithdrawal(updated),
    });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS POST ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}