import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { mergeUserFlagsForDisplay } from "@/lib/flags";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";

/** Lists all users for the admin user-management table. */
export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available", users: [] }, { status: 500 });
  }

  const auth = await requirePermission("MANAGE_USERS");
  if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false, users: [] });
    }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        frozen: true,
        accountStatus: true,
        flags: true,
        createdAt: true,
        updatedAt: true,
        wallet: { select: { balance: true } },
      },
    });
    const usersOut = users.map((u) => ({
      ...u,
      displayFlags: mergeUserFlagsForDisplay(u.flags as string[], u.role, u.createdAt),
    }));
    return NextResponse.json({ success: true, users: usersOut });
  } catch (e) {
    console.error("GET /api/admin/users/list:", e);
    return NextResponse.json({ success: false, message: "Failed to load users", users: [] }, { status: 500 });
  }
}
