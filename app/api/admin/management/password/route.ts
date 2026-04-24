import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isAdminRole } from "@/lib/admin-permissions";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  let body: { userId?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  const password = String(body.password ?? "").trim();
  if (!userId || !password) {
    return NextResponse.json({ message: "userId and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
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

  const hash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ ok: true, message: "Password updated" });
}
