import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { normalizePhoneWithCountry } from "@/lib/countries";

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

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email || !username || !password || !phone) {
      return NextResponse.json(
        { message: "Username, email, phone and password are required" },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    const existingUsername = await prisma.user.findFirst({ where: { username } });
    if (existingUsername) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    let assignedAgentId: string | null = null;
    let playerStatus: "active" | "inactive" = "inactive";

    const agentUsername = String(body.agent_username || "").trim();
    const agentCode = String(body.agent_code || "").trim();

    // 🔥 ربط عن طريق username
    if (agentUsername) {
      const agentUser = await prisma.user.findFirst({
        where: {
          username: agentUsername,
          role: "AGENT",
          frozen: false,
        },
      });

      if (!agentUser || !agentUser.agentId) {
        return NextResponse.json(
          { message: "Invalid agent username" },
          { status: 400 }
        );
      }

      assignedAgentId = agentUser.agentId;
      playerStatus = "active";
    }

    // 🔥 ربط عن طريق code
    if (!assignedAgentId && agentCode) {
      const agent = await prisma.agent.findFirst({
        where: {
          referralCode: agentCode,
          status: "account_created",
        },
      });

      if (!agent) {
        return NextResponse.json(
          { message: "Invalid agent code" },
          { status: 400 }
        );
      }

      assignedAgentId = agent.id;
      playerStatus = "active";
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: "PLAYER",
          playerStatus,
          assignedAgentId,
          frozen: false,
        },
      });

      const player = await tx.player.create({
        data: {
          userId: user.id,
          firstName: String(body.first_name || ""),
          lastName: String(body.last_name || ""),
          username,
          phone: normalizePhoneWithCountry(phone, body.country || "Morocco"),
          city: String(body.city || ""),
          country: String(body.country || "Morocco"),
          dateOfBirth: String(body.date_of_birth || ""),
          status: playerStatus,
          assignedAgentId,
        },
      });

      return { user, player };
    });

    return NextResponse.json({
      success: true,
      message: assignedAgentId
        ? "Account created and linked to agent ✅"
        : "Account created successfully ✅",
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        role: "player",
        player_status: result.user.playerStatus,
        assigned_agent_id: result.user.assignedAgentId || undefined,
        created_at: result.user.createdAt,
      },
      nextStep: "dashboard",
    });
  } catch (error) {
    console.error("REGISTER PLAYER ERROR:", error);
    return NextResponse.json(
      { message: "Something went wrong
We could not complete your request right now. Please try again." },
      { status: 500 }
    );
  }
}