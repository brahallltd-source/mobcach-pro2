import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database is not available", withdrawals: [] },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");

    const withdrawals = await prisma.withdrawal.findMany({
      where: kind ? { kind: String(kind) } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS GET ERROR:", error);
    return NextResponse.json(
      { message: "Server error", withdrawals: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database is not available" }, { status: 500 });
    }

    const { withdrawalId, action, note } = await req.json();

    if (!withdrawalId || !["mark_sent", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "withdrawalId and valid action are required" },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: String(withdrawalId) },
    });

    if (!withdrawal) {
      return NextResponse.json({ message: "Withdrawal request not found" }, { status: 404 });
    }

    if (action === "mark_sent" && withdrawal.status !== "pending") {
      return NextResponse.json(
        { message: "Admin can only mark pending requests as sent" },
        { status: 400 }
      );
    }

    if (action === "reject" && ["sent", "rejected", "completed"].includes(withdrawal.status)) {
      return NextResponse.json(
        { message: "This withdrawal can no longer be rejected" },
        { status: 400 }
      );
    }

    const updated = await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: action === "mark_sent" ? "sent" : "rejected",
        adminNote: String(note || "").trim() || null,
      },
    });

    const playerUser = await prisma.user.findFirst({
      where: { email: withdrawal.playerEmail },
    });

    if (playerUser?.id) {
      await createNotification({
        userId: playerUser.id,
        targetRole: "player",
        targetId: playerUser.id,
        title: action === "mark_sent" ? "Funds sent" : "Payout rejected by admin",
        message:
          action === "mark_sent"
            ? `Your ${withdrawal.kind === "winning" ? "winning " : ""}payout of ${withdrawal.amount} DH has been sent.`
            : "Your payout request was rejected by admin. Please contact support if needed.",
      });
    }

    return NextResponse.json({
      message: action === "mark_sent" ? "Funds marked as sent" : "Withdrawal rejected by admin",
      withdrawal: updated,
    });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
