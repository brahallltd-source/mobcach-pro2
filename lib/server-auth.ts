import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getPrisma } from "@/lib/db";

type AccessResult =
  | {
      ok: true;
      status: 200;
      message: "OK";
      user: {
        id: string;
        email: string;
        role: string;
        permissions?: unknown;
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

async function getAuthUser(): Promise<AccessResult> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("mobcash_session")?.value ||
      cookieStore.get("token")?.value ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("mobcash_token")?.value;

    if (!token) {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return { ok: false, status: 500, message: "JWT_SECRET is missing" };
    }

    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    const payload = verified.payload as {
      userId?: string;
      id?: string;
    };

    const userId = payload.userId || payload.id;
    if (!userId) {
      return { ok: false, status: 401, message: "Invalid token payload" };
    }

    const prisma = getPrisma();
    if (!prisma) {
      return { ok: false, status: 500, message: "Database not available" };
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        email: true,
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      return { ok: false, status: 401, message: "User not found" };
    }

    return {
      ok: true,
      status: 200,
      message: "OK",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    };
  } catch (error) {
    console.error("SERVER AUTH ERROR:", error);
    return { ok: false, status: 401, message: "Unauthorized" };
  }
}

export async function requireAdmin(): Promise<AccessResult> {
  const access = await getAuthUser();

  if (!access.ok) return access;

  if (String(access.user.role).toUpperCase() !== "ADMIN") {
    return { ok: false, status: 403, message: "Admin access required" };
  }

  return access;
}

export async function requireAdminPermission(permission: string): Promise<AccessResult> {
  const access = await requireAdmin();

  if (!access.ok) return access;

  const permissions = access.user.permissions as
    | Record<string, boolean>
    | null
    | undefined;

  if (!permission) return access;

  if (!permissions || permissions[permission] !== false) {
    return access;
  }

  return {
    ok: false,
    status: 403,
    message: `Missing admin permission: ${permission}`,
  };
}