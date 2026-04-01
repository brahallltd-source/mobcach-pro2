import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { normalize } from "@/lib/json";
import { signSessionToken, verifyPassword } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    const cleanIdentifier = normalize(identifier || "");
    const cleanPassword = String(password || "");

    if (!cleanIdentifier || !cleanPassword) {
      return NextResponse.json(
        { message: "Identifier and password are required" },
        { status: 400 }
      );
    }

    if (!isDatabaseEnabled()) {
      return NextResponse.json(
        { message: "Database not enabled" },
        { status: 500 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { username: cleanIdentifier },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        playerStatus: true,
        assignedAgentId: true,
        agentId: true,
        permissions: true,
        frozen: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.frozen) {
      return NextResponse.json(
        { message: "Account is frozen" },
        { status: 403 }
      );
    }

    const passwordOk = await verifyPassword(
      cleanPassword,
      String(user.passwordHash || "")
    );

    if (!passwordOk) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const role = String(user.role).toLowerCase();

    const publicUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role,
      player_status: user.playerStatus || undefined,
      assigned_agent_id: user.assignedAgentId || undefined,
      agentId: user.agentId || undefined,
      permissions: user.permissions || undefined,
      created_at: user.createdAt,
    };

    const token = await signSessionToken({
      id: user.id,
      role,
      email: user.email,
      username: user.username,
    });

    const res = NextResponse.json({ user: publicUser });

    res.cookies.set("mobcash_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}