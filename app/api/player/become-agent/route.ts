import { NextResponse } from "next/server";
import { normalize } from "@/lib/json";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available", application: null }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get("userId") || "").trim();
    const email = String(searchParams.get("email") || "").trim().toLowerCase();

    if (!userId && !email) {
      return NextResponse.json({ message: "userId or email is required", application: null }, { status: 400 });
    }

    const application = await prisma.agentApplication.findFirst({
      where: userId ? { userId } : { email },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ application: application || null });
  } catch (error) {
    console.error("GET BECOME AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error", application: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { userId, name, phone, email, note, username, country } = await req.json();
    const cleanUserId = String(userId || "").trim();
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanUsername = String(username || "").trim();
    const cleanPhone = normalizePhoneWithCountry(String(phone || "").trim(), String(country || "Morocco"));
    const cleanCountry = String(country || "Morocco").trim();
    const cleanNote = String(note || "").trim();

    if (!cleanUserId || !cleanName || !cleanPhone || !cleanEmail) {
      return NextResponse.json({ message: "userId, name, phone and email are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: cleanUserId } });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.role === "AGENT") {
      return NextResponse.json({ message: "This account is already an agent" }, { status: 400 });
    }

    const existing = await prisma.agentApplication.findFirst({
      where: {
        userId: cleanUserId,
        status: "pending",
      },
    });

    if (existing) {
      return NextResponse.json({ message: "You already have a pending application", application: existing }, { status: 400 });
    }

    const application = await prisma.agentApplication.create({
      data: {
        userId: cleanUserId,
        fullName: cleanName,
        username: cleanUsername || user.username,
        email: cleanEmail || user.email,
        phone: cleanPhone,
        country: cleanCountry,
        note: cleanNote || null,
        status: "pending",
      },
    });

    return NextResponse.json({
      message: "Agent application submitted successfully ✅",
      application,
    });
  } catch (error) {
    console.error("CREATE BECOME AGENT APPLICATION ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
