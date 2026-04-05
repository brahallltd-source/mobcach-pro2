import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAdminPermission } from "@/lib/server-auth";
import { normalize } from "@/lib/json";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

const prisma = new PrismaClient();

const ALLOWED_PERMISSIONS = [
  "overview",
  "agents",
  "players",
  "orders",
  "fraud",
  "withdrawals",
  "wallets",
  "branding",
  "notifications",
  "bonus_claims",
];

export async function GET() {
  const access = await requireAdminPermission("overview");
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const admins = await prisma.user.findMany({
      where: {
role: "ADMIN",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ admins });
  } catch (error) {
    console.error("ADMIN USERS GET ERROR:", error);
    return NextResponse.json(
      {
        message: `Something went wrong
We could not complete your request right now. Please try again.`,
        admins: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("overview");
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const body = await req.json();
    const { email, username, password, permissions } = body;

    if (!email || !username || !password) {
      return NextResponse.json(
        { message: "email, username and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalize(String(email));
    const normalizedUsername = normalize(String(username));

    const existingByEmail = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingByEmail) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    const existingByUsername = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingByUsername) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const safePermissions = Array.isArray(permissions)
      ? permissions.filter((item) => ALLOWED_PERMISSIONS.includes(String(item)))
      : ["overview", "orders", "notifications"];

    const hashedPassword = await hashPassword(String(password));

    const admin = await prisma.user.create({
      data: {
        email: String(email).trim().toLowerCase(),
        username: String(username).trim(),
        passwordHash: hashedPassword,
        role: "admin",
        permissions: safePermissions,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: "Admin created successfully ✅",
      admin,
    });
  } catch (error) {
    console.error("ADMIN USERS POST ERROR:", error);
    return NextResponse.json(
      {
        message: `Something went wrong
We could not complete your request right now. Please try again.`,
      },
      { status: 500 }
    );
  }
}