import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const { playerEmail } = await req.json();
    const cleanEmail = String(playerEmail || "").trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json(
        { message: "playerEmail is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        role: "PLAYER",
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Player user not found" },
        { status: 404 }
      );
    }

    const player = await prisma.player.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!player) {
      return NextResponse.json(
        { message: "Player profile not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          assignedAgentId: null,
          playerStatus: "inactive",
        },
      });

      await tx.player.update({
        where: { id: player.id },
        data: {
          assignedAgentId: null,
          status: "inactive",
        },
      });

      await tx.activation.deleteMany({
        where: {
          playerUserId: user.id,
        },
      });

      return updatedUser;
    });

    createNotification({
      targetRole: "player",
      targetId: updated.id,
      title: "Agent unlinked",
      message: "You can now choose another agent.",
    });

    return NextResponse.json({
      success: true,
      message: "Agent removed successfully ✅",
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        role: String(updated.role).toLowerCase(),
        player_status: updated.playerStatus,
        assigned_agent_id: updated.assignedAgentId || undefined,
        created_at: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("CHANGE AGENT ERROR:", error);
    return NextResponse.json(
      { message: "Something went wrong
We could not complete your request right now. Please try again." },
      { status: 500 }
    );
  }
}