import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  const auth = await requirePermission("MANAGE_USERS");
  if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false });
    }
  const adminUserId = auth.user.id;

  let body: { userId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, frozen: true, agentProfile: { select: { id: true } } },
  });
  if (!target) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const nextFrozen = !target.frozen;
  if (nextFrozen && userId === adminUserId) {
    return NextResponse.json(
      { success: false, message: "You cannot freeze your own admin account." },
      { status: 400 }
    );
  }

  const nextAccountStatus = nextFrozen ? UserAccountStatus.SUSPENDED : UserAccountStatus.ACTIVE;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        frozen: nextFrozen,
        accountStatus: nextAccountStatus,
      },
    });
    if (target.agentProfile) {
      await tx.agent.update({
        where: { id: target.agentProfile.id },
        data: { status: nextFrozen ? "FROZEN" : "ACTIVE" },
      });
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      frozen: true,
      accountStatus: true,
      createdAt: true,
      updatedAt: true,
      wallet: { select: { balance: true } },
    },
  });

  return NextResponse.json({
    success: true,
    frozen: nextFrozen,
    message: nextFrozen ? "تم تجميد الحساب" : "تم إلغاء التجميد",
    user,
  });
}
