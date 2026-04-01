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

    const { playerEmail, agentId } = await req.json();

    const cleanEmail = String(playerEmail || "").trim().toLowerCase();
    const cleanAgentId = String(agentId || "").trim();

    if (!cleanEmail || !cleanAgentId) {
      return NextResponse.json(
        { message: "playerEmail and agentId are required" },
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

    const agent = await prisma.agent.findFirst({
      where: {
        id: cleanAgentId,
        status: "account_created",
      },
    });

    if (!agent) {
      return NextResponse.json(
        { message: "Agent not found" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          assignedAgentId: cleanAgentId,
          playerStatus: "active",
        },
      });

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          assignedAgentId: cleanAgentId,
          status: "active",
          referredBy: player.referredBy || cleanAgentId,
        },
      });

      const existingActivation = await tx.activation.findFirst({
        where: {
          playerUserId: user.id,
        },
      });

      if (existingActivation) {
        await tx.activation.update({
          where: { id: existingActivation.id },
          data: {
            agentId: cleanAgentId,
            playerEmail: updatedUser.email,
            username: updatedUser.username,
            whatsapp: updatedPlayer.phone || "",
            status: "pending_activation",
          },
        });
      } else {
        await tx.activation.create({
          data: {
            agentId: cleanAgentId,
            playerUserId: updatedUser.id,
            playerEmail: updatedUser.email,
            username: updatedUser.username,
            passwordPlain: "",
            whatsapp: updatedPlayer.phone || "",
            status: "pending_activation",
          },
        });
      }

      await tx.order.create({
        data: {
          agentId: cleanAgentId,
          playerEmail: updatedUser.email,
          amount: 0,
          gosportUsername: "",
          status: "linked_waiting_first_order",
        },
      });

      return { updatedUser, updatedPlayer };
    });

    createNotification({
      targetRole: "agent",
      targetId: cleanAgentId,
      title: "New linked player",
      message: `${cleanEmail} selected you as preferred agent.`,
    });

    createNotification({
      targetRole: "player",
      targetId: user.id,
      title: "Agent linked successfully",
      message:
        "Your account is now linked to the selected agent. You can start the recharge flow immediately.",
    });

    return NextResponse.json({
      success: true,
      message: "Agent selected successfully ✅",
      user: {
        id: result.updatedUser.id,
        email: result.updatedUser.email,
        username: result.updatedUser.username,
        role: String(result.updatedUser.role).toLowerCase(),
        player_status: result.updatedUser.playerStatus,
        assigned_agent_id: result.updatedUser.assignedAgentId || undefined,
        created_at: result.updatedUser.createdAt,
      },
      player: result.updatedPlayer,
    });
  } catch (error) {
    console.error("SELECT AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}