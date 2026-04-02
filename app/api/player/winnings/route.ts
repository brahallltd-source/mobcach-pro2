import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

function mapWithdrawal(item: any) {
  return {
    id: item.id,
    amount: Number(item.amount || 0),
    method: item.method,
    status: item.status,
    created_at: item.createdAt,
    cashProvider: item.cashProvider || null,
    rib: item.rib || null,
    swift: item.swift || null,
    gosportUsername: item.gosportUsername || null,
  };
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ winning: null, history: [] }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const playerEmail = String(searchParams.get("playerEmail") || "")
      .trim()
      .toLowerCase();

    if (!playerEmail) {
      return NextResponse.json(
        { message: "playerEmail is required", winning: null, history: [] },
        { status: 400 }
      );
    }

    const playerUser = await prisma.user.findFirst({
      where: {
        email: playerEmail,
        role: "PLAYER",
      },
    });

    if (!playerUser) {
      return NextResponse.json({ winning: null, history: [] });
    }

    const player = await prisma.player.findFirst({
      where: { userId: playerUser.id },
    });

    const winningOrder = await prisma.order.findFirst({
      where: {
        playerEmail,
        status: "completed",
      },
      orderBy: { updatedAt: "desc" },
    });

    let history: any[] = [];

    if (player) {
      history = await prisma.withdrawal.findMany({
        where: {
          playerId: player.id,
          kind: "winner",
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      winning: winningOrder
        ? {
            id: winningOrder.id,
            amount: Number(winningOrder.amount || 0),
            payment_method_name: winningOrder.paymentMethodName || null,
            gosport365_username: winningOrder.gosportUsername || null,
            status: winningOrder.status,
            created_at: winningOrder.createdAt,
          }
        : null,
      history: history.map(mapWithdrawal),
    });
  } catch (error) {
    console.error("PLAYER WINNINGS GET ERROR:", error);
    return NextResponse.json(
      { message: "Server error", winning: null, history: [] },
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

    const playerEmail = String(body.playerEmail || "").trim().toLowerCase();
    const orderId = String(body.orderId || "").trim();
    const method = String(body.method || "").trim();
    const amount = Number(body.amount || 0);

    const gosportUsername = String(body.gosportUsername || "").trim();
    const gosportPassword = String(body.gosportPassword || "").trim();

    const rib = String(body.rib || "").trim();
    const swift = String(body.swift || "").trim();
    const cashProvider = String(body.cashProvider || "").trim();
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const city = String(body.city || "").trim();

    if (!playerEmail || !orderId || !method || !amount) {
      return NextResponse.json(
        { message: "playerEmail, orderId, method and amount are required" },
        { status: 400 }
      );
    }

    if (!gosportUsername || !gosportPassword) {
      return NextResponse.json(
        { message: "GoSport365 username and password are required" },
        { status: 400 }
      );
    }

    if (!["bank", "cash"].includes(method)) {
      return NextResponse.json(
        { message: "Invalid withdrawal method" },
        { status: 400 }
      );
    }

    if (method === "bank" && (!rib || !swift)) {
      return NextResponse.json(
        { message: "RIB and SWIFT are required for bank withdrawal" },
        { status: 400 }
      );
    }

    if (method === "cash" && (!cashProvider || !fullName || !phone || !city)) {
      return NextResponse.json(
        { message: "Cash withdrawal fields are required" },
        { status: 400 }
      );
    }

    const playerUser = await prisma.user.findFirst({
      where: {
        email: playerEmail,
        role: "PLAYER",
      },
    });

    if (!playerUser) {
      return NextResponse.json(
        { message: "Player user not found" },
        { status: 404 }
      );
    }

    const player = await prisma.player.findFirst({
      where: { userId: playerUser.id },
    });

    if (!player) {
      return NextResponse.json(
        { message: "Player profile not found" },
        { status: 404 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        playerEmail,
        status: "completed",
      },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Winning order not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.withdrawal.findFirst({
      where: {
        playerId: player.id,
        winnerOrderId: order.id,
        kind: "winner",
        status: {
          in: ["pending", "sent", "completed"],
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "A winning payout request already exists for this order" },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        playerId: player.id,
        playerEmail,
        agentId: order.agentId,
        amount,
        method,
        status: "pending",
        rib: method === "bank" ? rib : null,
        swift: method === "bank" ? swift : null,
        cashProvider: method === "cash" ? cashProvider : null,
        fullName: method === "cash" ? fullName : null,
        phone: method === "cash" ? phone : null,
        city: method === "cash" ? city : null,
        kind: "winner",
        gosportUsername,
        winnerOrderId: order.id,
        adminNote: `GoSport365 password: ${gosportPassword}`,
      },
    });

    const adminUsers = await prisma.user.findMany({
      where: {
        role: "ADMIN",
      },
      select: { id: true },
    });

    for (const admin of adminUsers) {
      await createNotification({
        userId: admin.id,
        targetRole: "admin",
        targetId: admin.id,
        title: "New winning payout request",
        message: `A winning payout request of ${amount} DH was submitted by ${playerEmail}.`,
      });
    }

    return NextResponse.json({
      message: "Winning payout request sent to admin successfully",
      withdrawal: mapWithdrawal(withdrawal),
    });
  } catch (error) {
    console.error("PLAYER WINNINGS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}