import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createNotification } from "@/lib/notifications";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database is not available", winner: null, history: [] },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const playerEmail = searchParams.get("playerEmail");
    if (!playerEmail) {
      return NextResponse.json({ message: "playerEmail is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: playerEmail },
      include: { player: true },
    });

    if (!user?.player) {
      return NextResponse.json({ winner: null, history: [] });
    }

    const winnerOrder = await prisma.order.findFirst({
      where: {
        playerId: user.player.id,
        status: "completed",
      },
      orderBy: { updatedAt: "desc" },
    });

    const history = await prisma.withdrawal.findMany({
      where: {
        playerId: user.player.id,
        kind: "winning",
      },
      orderBy: { createdAt: "desc" },
    });

    const winner = winnerOrder
      ? {
          id: winnerOrder.id,
          amount: winnerOrder.amount,
          title: winnerOrder.gosportUsername,
          status: winnerOrder.status,
          createdAt: winnerOrder.createdAt,
        }
      : null;

    return NextResponse.json({ winner, history });
  } catch (error) {
    console.error("PLAYER WINNINGS GET ERROR:", error);
    return NextResponse.json(
      { message: "Server error", winner: null, history: [] },
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

    const body = await req.json();
    const {
      playerEmail,
      method,
      amount,
      rib,
      swift,
      ribConfirm,
      swiftConfirm,
      cashProvider,
      fullName,
      phone,
      city,
      username,
      usernameConfirm,
      password,
      passwordConfirm,
    } = body;

    if (!playerEmail || !method || !amount) {
      return NextResponse.json(
        { message: "playerEmail, method and amount are required" },
        { status: 400 }
      );
    }

    if (!username || !usernameConfirm || !password || !passwordConfirm) {
      return NextResponse.json(
        { message: "Username/password confirmation is required" },
        { status: 400 }
      );
    }

    if (String(username).trim() !== String(usernameConfirm).trim()) {
      return NextResponse.json(
        { message: "Username confirmation does not match" },
        { status: 400 }
      );
    }

    if (String(password) !== String(passwordConfirm)) {
      return NextResponse.json(
        { message: "Password confirmation does not match" },
        { status: 400 }
      );
    }

    if (method === "bank") {
      if (!rib || !swift || !ribConfirm || !swiftConfirm) {
        return NextResponse.json(
          { message: "RIB, SWIFT and their confirmations are required" },
          { status: 400 }
        );
      }
      if (
        String(rib).trim() !== String(ribConfirm).trim() ||
        String(swift).trim() !== String(swiftConfirm).trim()
      ) {
        return NextResponse.json({ message: "Bank confirmations do not match" }, { status: 400 });
      }
    }

    if (method === "cash") {
      if (!cashProvider || !fullName || !phone || !city) {
        return NextResponse.json(
          { message: "Cash provider, full name, phone and city are required" },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: String(playerEmail) },
      include: { player: true },
    });

    if (!user?.player) {
      return NextResponse.json({ message: "Player account not found" }, { status: 404 });
    }

    const expectedUsername = user.username || user.player.username;
    if (String(expectedUsername).trim() !== String(username).trim()) {
      return NextResponse.json({ message: "Username is incorrect" }, { status: 400 });
    }

    const passwordOk = await bcrypt.compare(String(password), user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ message: "Password is incorrect" }, { status: 400 });
    }

    const winnerOrder = await prisma.order.findFirst({
      where: {
        playerId: user.player.id,
        status: "completed",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!winnerOrder) {
      return NextResponse.json({ message: "Winner entry not found" }, { status: 404 });
    }

    if (Number(amount) !== Number(winnerOrder.amount)) {
      return NextResponse.json(
        { message: "Amount must match the winning amount" },
        { status: 400 }
      );
    }

    const activeRequest = await prisma.withdrawal.findFirst({
      where: {
        playerId: user.player.id,
        kind: "winning",
        status: { in: ["pending", "sent"] },
      },
    });

    if (activeRequest) {
      return NextResponse.json({ message: "A payout request is already in progress" }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        playerId: user.player.id,
        playerEmail: user.email,
        agentId: null,
        amount: Number(amount),
        method: String(method),
        status: "pending",
        rib: method === "bank" ? String(rib || "").trim() : null,
        swift: method === "bank" ? String(swift || "").trim() : null,
        cashProvider: method === "cash" ? String(cashProvider || "").trim() : null,
        fullName: String(fullName || "").trim() || null,
        phone: String(phone || "").trim() || null,
        city: String(city || "").trim() || null,
        kind: "winning",
        gosportUsername: winnerOrder.gosportUsername,
        winnerOrderId: winnerOrder.id,
        adminNote: null,
      },
    });

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });

    if (admin) {
      await createNotification({
        userId: admin.id,
        targetRole: "admin",
        targetId: admin.id,
        title: "New winning payout request",
        message: `Player ${user.email} submitted a winning payout request for ${withdrawal.amount} DH (${winnerOrder.gosportUsername}).`,
      });
    }

    await createNotification({
      userId: user.id,
      targetRole: "player",
      targetId: user.id,
      title: "Payout request submitted",
      message: "Your winning payout request is now pending admin review.",
    });

    return NextResponse.json({ message: "Payout request submitted successfully", withdrawal });
  } catch (error) {
    console.error("PLAYER WINNINGS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
