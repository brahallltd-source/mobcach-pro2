import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isSuperAdminRole } from "@/lib/admin-permissions";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  let body: { userId?: unknown; suspended?: unknown; accountStatus?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
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

  const roleU = String(target.role).toUpperCase();
  if (roleU !== "ADMIN" && roleU !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Target is not an admin user" }, { status: 400 });
  }

  let nextStatus: UserAccountStatus;
  if (typeof body.suspended === "boolean") {
    nextStatus = body.suspended ? UserAccountStatus.SUSPENDED : UserAccountStatus.ACTIVE;
  } else if (body.accountStatus != null) {
    const raw = String(body.accountStatus).trim().toUpperCase();
    if (raw !== "ACTIVE" && raw !== "SUSPENDED") {
      return NextResponse.json({ message: "accountStatus must be ACTIVE or SUSPENDED" }, { status: 400 });
    }
    nextStatus = raw === "SUSPENDED" ? UserAccountStatus.SUSPENDED : UserAccountStatus.ACTIVE;
  } else {
    return NextResponse.json({ message: "Provide suspended (boolean) or accountStatus" }, { status: 400 });
  }

  if (nextStatus === UserAccountStatus.SUSPENDED && isSuperAdminRole(target.role)) {
    const otherSupers = await prisma.user.count({
      where: {
        role: { equals: "SUPER_ADMIN", mode: "insensitive" },
        deletedAt: null,
        accountStatus: UserAccountStatus.ACTIVE,
        frozen: false,
        NOT: { id: userId },
      },
    });
    if (otherSupers < 1) {
      return NextResponse.json(
        { message: "Cannot suspend the last active SUPER_ADMIN" },
        { status: 400 }
      );
    }
  }

  if (userId === access.user.id && nextStatus === UserAccountStatus.SUSPENDED) {
    return NextResponse.json({ message: "You cannot suspend your own account" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: nextStatus,
      frozen: nextStatus === UserAccountStatus.SUSPENDED,
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      accountStatus: true,
      frozen: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
