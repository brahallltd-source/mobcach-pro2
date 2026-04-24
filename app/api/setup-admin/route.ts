import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary bootstrap: upserts the fixed admin user (email `admin@mobcash.com`).
 * Disabled in production unless `ALLOW_SETUP_ADMIN=1` is set (remove after first use).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SETUP_ADMIN !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isDatabaseEnabled()) {
    return NextResponse.json(
      { success: false, message: "Database is not configured." },
      { status: 500 }
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { success: false, message: "Database client is not available." },
      { status: 500 }
    );
  }

  const email = "admin@mobcash.com";
  const username = "admin";

  try {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        username,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      update: {
        username,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    // Login/session include `wallet: true`; ensure a row exists (optional in schema but expected for UX).
    const existingWallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });
    if (!existingWallet) {
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Admin created with hashed password",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
