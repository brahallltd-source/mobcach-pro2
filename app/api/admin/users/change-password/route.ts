import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
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

  let body: { userId?: unknown; newPassword?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!userId) {
    return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { success: false, message: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });
  if (!target || target.deletedAt != null) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: `Admin ${adminUserId} changed password for User ${userId}`,
        entityType: "User",
        entityId: userId,
        meta: { adminUserId, targetUserId: userId },
      },
    });
  });

  return NextResponse.json({ success: true });
}
