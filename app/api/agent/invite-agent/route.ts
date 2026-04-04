import { NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function mapInvite(log: any) {
  const meta = (log.meta || {}) as Record<string, any>;

  return {
    id: log.id,
    referrer_agent_id: meta.referrer_agent_id || log.entityId || "",
    invited_agent_email: meta.invited_agent_email || "",
    invite_code: meta.invite_code || "",
    invite_link: meta.invite_link || "",
    total_recharge_amount: Number(meta.total_recharge_amount || 0),
    bonus_awarded: Boolean(meta.bonus_awarded),
    created_at: log.createdAt,
    updated_at: meta.updated_at || log.createdAt,
  };
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available", invites: [] },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = String(searchParams.get("agentId") || "").trim();

    if (!agentId) {
      return NextResponse.json(
        { message: "agentId is required", invites: [] },
        { status: 400 }
      );
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        action: "agent_invite_generated",
        entityType: "agent_invite",
        entityId: agentId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      invites: logs.map(mapInvite),
    });
  } catch (error) {
    console.error("GET INVITE AGENT ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, invites: [] },
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
    const agentId = String(body.agentId || "").trim();
    const type = String(body.type || "").trim();
    const invitedAgentEmail = String(body.invitedAgentEmail || "")
      .trim()
      .toLowerCase();

    if (!agentId) {
      return NextResponse.json(
        { message: "agentId is required" },
        { status: 400 }
      );
    }

    const referrerAgent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!referrerAgent) {
      return NextResponse.json(
        { message: "Referrer agent not found" },
        { status: 404 }
      );
    }

    if (type === "generate") {
      const code = `AG-${String(agentId).slice(-6)}-${Date.now()
        .toString()
        .slice(-4)}`;
      const inviteLink = `/apply/agent?ref=${encodeURIComponent(code)}`;

      const log = await prisma.auditLog.create({
        data: {
          action: "agent_invite_generated",
          entityType: "agent_invite",
          entityId: agentId,
          meta: {
            referrer_agent_id: agentId,
            invited_agent_email: invitedAgentEmail,
            invite_code: code,
            invite_link: inviteLink,
            total_recharge_amount: 0,
            bonus_awarded: false,
            updated_at: new Date().toISOString(),
          },
        },
      });

      return NextResponse.json({
        message: "Invite code generated successfully",
        invite: mapInvite(log),
        inviteLink,
      });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        action: "agent_invite_generated",
        entityType: "agent_invite",
        entityId: agentId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const related = logs.map(mapInvite);
    const totalRechargeAmount = related.reduce(
      (sum, item) => sum + Number(item.total_recharge_amount || 0),
      0
    );
    const invitedAgentsCount = related.length;

    if (related.some((item) => item.bonus_awarded)) {
      return NextResponse.json(
        { message: "Agent referral bonus already awarded" },
        { status: 400 }
      );
    }

    if (!(invitedAgentsCount >= 5 || totalRechargeAmount >= 5000)) {
      return NextResponse.json(
        { message: "Threshold not reached yet" },
        { status: 400 }
      );
    }

    await creditWallet(agentId, 500, "invite_agent_bonus", {
      invitedAgentsCount,
      totalRechargeAmount,
      targetAmount: 5000,
      targetAgents: 5,
    });

    for (const log of logs) {
      const meta = (log.meta || {}) as Record<string, any>;

      await prisma.auditLog.update({
        where: { id: log.id },
        data: {
          meta: {
            ...meta,
            bonus_awarded: true,
            updated_at: new Date().toISOString(),
          },
        },
      });
    }

    await createNotification({
      targetRole: "agent",
      targetId: agentId,
      title: "Agent invite bonus awarded",
      message: "You received 500 DH for inviting agents.",
    });

    return NextResponse.json({
      message: "Agent invite bonus awarded successfully",
      summary: {
        agentId,
        invitedAgentsCount,
        totalRechargeAmount,
        bonusAmount: 500,
      },
    });
  } catch (error) {
    console.error("POST INVITE AGENT ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}