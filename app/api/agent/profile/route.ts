import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { rejectAgentIfSuspended } from "@/lib/agent-account-guard";
import { agentProfileUpdateSchema } from "@/lib/agent-profile-update";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { hashPassword, verifyPassword } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Auth: cookie session via {@link getSessionUserFromCookies}.
 * `GET`: dashboard + profile form (includes `username` read-only on the client).
 * `PATCH`: updates `Agent` + `User` profile fields — **never** applies `username` from the body.
 */
/** Agent row fields needed by dashboard + settings (explicit select avoids stale include graphs). */
const AGENT_PROFILE_API_SELECT = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  phone: true,
  country: true,
  status: true,
  referralCode: true,
  online: true,
  note: true,
  responseMinutes: true,
  defaultExecutionTimeMinutes: true,
  rating: true,
  successRate: true,
  tradesCount: true,
  availableBalance: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} as const;

export async function GET(_req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json(
        { status: "ERROR", message: "Unauthorized", error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (String(session.role).trim().toUpperCase() !== "AGENT") {
      return NextResponse.json(
        { status: "ERROR", message: "Forbidden", error: "Forbidden" },
        { status: 403 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { status: "ERROR", message: "Database unavailable", error: "Database unavailable" },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        role: true,
        status: true,
        username: true,
        email: true,
        agentProfile: { select: AGENT_PROFILE_API_SELECT },
        wallet: {
          select: {
            id: true,
            userId: true,
            balance: true,
            agentId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { status: "NOT_FOUND", error: "User not found" },
        { status: 404 }
      );
    }
    if (String(user.role).trim().toUpperCase() !== "AGENT") {
      return NextResponse.json(
        { status: "ERROR", message: "Forbidden", error: "Forbidden" },
        { status: 403 }
      );
    }

    const agent = user.agentProfile;
    const realAgentId = agent?.id ?? user.id;
    return NextResponse.json(
      {
        success: true,
        status: String(user.status ?? "PENDING"),
        username: String(user.username ?? ""),
        email: String(user.email ?? ""),
        phone: String(agent?.phone ?? ""),
        fullName: String(agent?.fullName ?? ""),
        realAgentId: String(realAgentId),
        isApproved: agent?.verified ?? null,
        agentProfile: agent,
        wallet: user.wallet,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DASHBOARD_API_ERROR]", error);
    return NextResponse.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role).trim().toUpperCase() !== "AGENT") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
    }

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const raw = await req.json().catch(() => ({}));
    const parsed = agentProfileUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "بيانات غير صالحة";
      return NextResponse.json({ message: msg, issues: parsed.error.flatten() }, { status: 400 });
    }

    const { fullName, email, phone, currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { agentProfile: true },
    });
    if (!user?.agentProfile) {
      return NextResponse.json({ message: "ملف الوكيل غير موجود" }, { status: 404 });
    }

    const emailNorm = email.trim().toLowerCase();
    const other = await prisma.user.findFirst({
      where: {
        email: emailNorm,
        NOT: { id: user.id },
      },
      select: { id: true },
    });
    if (other) {
      return NextResponse.json({ message: "هذا البريد مستخدم من حساب آخر" }, { status: 400 });
    }

    const otherAgentEmail = await prisma.agent.findFirst({
      where: {
        email: emailNorm,
        NOT: { id: user.agentProfile.id },
      },
      select: { id: true },
    });
    if (otherAgentEmail) {
      return NextResponse.json({ message: "هذا البريد مستخدم من وكيل آخر" }, { status: 400 });
    }

    let nextHash: string | undefined;
    if (newPassword && newPassword.length > 0 && currentPassword) {
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ message: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
      }
      nextHash = await hashPassword(newPassword);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: emailNorm,
          ...(nextHash ? { passwordHash: nextHash } : {}),
        },
      });
      await tx.agent.update({
        where: { id: user.agentProfile!.id },
        data: {
          fullName: fullName.trim(),
          email: emailNorm,
          phone: phone.trim(),
        },
      });
    });

    return NextResponse.json({ success: true, message: "تم حفظ التعديلات" });
  } catch (e) {
    console.error("PATCH /api/agent/profile:", e);
    return NextResponse.json({ message: "فشل التحديث" }, { status: 500 });
  }
}
