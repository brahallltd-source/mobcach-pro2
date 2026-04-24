import { randomBytes } from "crypto";
import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { defaultPermissionsForNewAdmin, isSuperAdminRole } from "@/lib/admin-permissions";
import { ALL_PERMISSION_IDS, isValidPermissionId } from "@/lib/permissions";
import { normalize } from "@/lib/json";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { hashPassword } from "@/lib/security";
import { loadManyUserPermissionsForAuth, loadUserPermissionsForAuth } from "@/lib/user-permissions-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function GET() {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { admins: [] });
    }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ admins: [] });
  }

  try {
    const [admins, me] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { role: { equals: "ADMIN", mode: "insensitive" } },
            { role: { equals: "SUPER_ADMIN", mode: "insensitive" } },
          ],
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
          accountStatus: true,
          frozen: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: access.user.id },
        select: { id: true, role: true },
      }),
    ]);

    const adminIds = admins.map((a) => a.id);
    const permMap = await loadManyUserPermissionsForAuth(prisma, adminIds);
    const mePermissions = me ? await loadUserPermissionsForAuth(prisma, me.id) : [];

    const adminsOut = admins.map((a) => ({
      ...a,
      permissions: isSuperAdminRole(a.role) ? ALL_PERMISSION_IDS : (permMap.get(a.id) ?? []),
    }));

    return NextResponse.json({
      admins: adminsOut,
      requester: me
        ? {
            id: me.id,
            role: me.role,
            permissions: isSuperAdminRole(me.role) ? ALL_PERMISSION_IDS : mePermissions,
          }
        : {
            id: access.user.id,
            role: access.user.role,
            permissions: ALL_PERMISSION_IDS,
          },
    });
  } catch (error) {
    console.error("ADMIN USERS GET ERROR:", error);
    return NextResponse.json(
      {
        message: "Could not load admins.",
        admins: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  try {
    const requester = await prisma.user.findUnique({
      where: { id: access.user.id },
      select: { role: true },
    });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const email = String(body.email ?? "").trim();
    const username = String(body.username ?? "").trim();
    const passwordRaw = body.password != null ? String(body.password) : "";
    const permissionsRaw = body.permissions;

    if (!email || !username) {
      return NextResponse.json({ message: "email and username are required" }, { status: 400 });
    }

    let targetRole = "ADMIN";
    if (String(body.role ?? "").trim().toUpperCase() === "SUPER_ADMIN") {
      if (!isSuperAdminRole(requester?.role)) {
        return NextResponse.json(
          { message: "Only a SUPER_ADMIN can create another SUPER_ADMIN" },
          { status: 403 }
        );
      }
      targetRole = "SUPER_ADMIN";
    }

    let temporaryPassword: string | undefined;
    const passwordToHash =
      passwordRaw.trim().length > 0 ? passwordRaw.trim() : (temporaryPassword = generateTempPassword());

    if (passwordToHash.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    }

    const normalizedEmail = normalize(String(email));
    const normalizedUsername = normalize(String(username));

    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByEmail) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    const existingByUsername = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByUsername) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const safePermissions = Array.isArray(permissionsRaw)
      ? permissionsRaw.map((x) => String(x).trim()).filter(isValidPermissionId)
      : defaultPermissionsForNewAdmin();
    const finalPerms =
      safePermissions.length > 0 ? safePermissions : defaultPermissionsForNewAdmin();

    const hashedPassword = await hashPassword(passwordToHash);

    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash: hashedPassword,
        role: targetRole,
        permissions: finalPerms,
        accountStatus: UserAccountStatus.ACTIVE,
        frozen: false,
        status: "ACTIVE",
      },
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

    return NextResponse.json({
      message: "Admin created successfully",
      admin: { ...admin, permissions: finalPerms },
      ...(temporaryPassword != null ? { temporaryPassword } : {}),
    });
  } catch (error) {
    console.error("ADMIN USERS POST ERROR:", error);
    return NextResponse.json({ message: "Could not create admin" }, { status: 500 });
  }
}
