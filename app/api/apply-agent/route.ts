import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const fullName = String(body.fullName || body.full_name || "").trim();
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

if (!password) {
  return NextResponse.json(
    { message: "Password is required" },
    { status: 400 }
  );
}
    const phone = String(body.phone || "").trim();
    const country = String(body.country || "Morocco").trim();
    const note = String(body.note || "").trim();

    if (!fullName || !username || !email) {
      return NextResponse.json(
        { success: false, message: "fullName, username and email are required" },
        { status: 400 }
      );
    }

    const existingPending = await prisma.agentApplication.findFirst({
      where: {
        OR: [{ email }, { username }],
        status: "pending",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { success: false, message: "You already have a pending application" },
        { status: 400 }
      );
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (!user) {
      const passwordHash = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: "PLAYER",
          frozen: false,
          playerStatus: "inactive",
        },
      });
    } else if (user.role === "AGENT") {
      return NextResponse.json(
        { success: false, message: "This account is already an agent" },
        { status: 400 }
      );
    }

    const application = await prisma.agentApplication.create({
      data: {
        userId: user.id,
        fullName,
        username,
        email,
        phone,
        country: country || null,
        note: note || null,
        status: "pending",
      },
    });

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error("APPLY AGENT ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong
We could not complete your request right now. Please try again." },
      { status: 500 }
    );
  }
}