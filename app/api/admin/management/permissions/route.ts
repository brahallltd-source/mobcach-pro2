import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isSuperAdminRole } from "@/lib/admin-permissions";
import { isValidPermissionId, normalizeStoredPermissions } from "@/lib/permissions";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const access = await requirePermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  let body: { userId?: unknown; permissions?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
  }

  if (!Array.isArray(body.permissions)) {
    return NextResponse.json({ message: "permissions must be an array of strings" }, { status: 400 });
  }

  const next = body.permissions.map((x) => String(x).trim()).filter(isValidPermissionId);

  const [target, actor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, deletedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: access.user.id },
      select: { role: true },
    }),
  ]);

  if (!target || target.deletedAt != null) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const targetRole = String(target.role).toUpperCase();
  if (targetRole !== "ADMIN" && targetRole !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Target is not an admin" }, { status: 400 });
  }

  if (isSuperAdminRole(target.role) && !isSuperAdminRole(actor?.role)) {
    return NextResponse.json({ message: "Only SUPER_ADMIN can edit a SUPER_ADMIN" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { permissions: next },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
      accountStatus: true,
      frozen: true,
    },
  });

  const effectivePermissions = normalizeStoredPermissions(next);

  return NextResponse.json({
    message: "Permissions updated",
    admin: { ...updated, permissions: next, effectivePermissions },
  });
}
