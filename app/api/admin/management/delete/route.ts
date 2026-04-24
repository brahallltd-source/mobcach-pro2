import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isAdminRole, isSuperAdminRole } from "@/lib/admin-permissions";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") ?? "").trim();
  if (!userId) {
    return NextResponse.json({ message: "userId query parameter is required" }, { status: 400 });
  }

  if (userId === access.user.id) {
    return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt != null) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  if (!isAdminRole(target.role)) {
    return NextResponse.json({ message: "Target is not an admin user" }, { status: 400 });
  }

  if (isSuperAdminRole(target.role)) {
    const others = await prisma.user.count({
      where: {
        role: { equals: "SUPER_ADMIN", mode: "insensitive" },
        deletedAt: null,
        NOT: { id: userId },
      },
    });
    if (others < 1) {
      return NextResponse.json({ message: "Cannot remove the last SUPER_ADMIN" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true, message: "Admin removed" });
}
