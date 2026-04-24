import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";
import { hashPassword } from "@/lib/security";
import { EXECUTION_TIME_OPTIONS } from "@/lib/payment-options";

export const runtime = "nodejs";

/** Load agent workspace metadata (`?agentId=` = `Agent.id` or legacy `User.id`). */
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available", agent: null, profile: null },
        { status: 500 }
      );
    }
    const { searchParams } = new URL(req.url);
    const rawId = String(searchParams.get("agentId") || "").trim();
    if (!rawId) {
      return NextResponse.json({ message: "agentId مطلوب", agent: null, profile: null }, { status: 400 });
    }

    const agentRow = await prisma.agent.findFirst({
      where: { OR: [{ id: rawId }, { userId: rawId }] },
      include: {
        user: { select: { email: true } },
      },
    });
    if (!agentRow) {
      return NextResponse.json({ agent: null, profile: null }, { status: 404 });
    }

    return NextResponse.json({
      agent: {
        id: agentRow.id,
        fullName: agentRow.fullName,
        email: agentRow.email,
        phone: agentRow.phone,
        status: agentRow.status,
      },
      profile: {
        agentId: agentRow.id,
        responseMinutes: agentRow.responseMinutes,
        defaultExecutionTimeMinutes: agentRow.defaultExecutionTimeMinutes,
        rating: agentRow.rating,
        tradesCount: agentRow.tradesCount,
      },
    });
  } catch (e) {
    console.error("AGENT SETTINGS GET:", e);
    return NextResponse.json({ agent: null, profile: null }, { status: 500 });
  }
}

/**
 * Legacy: email / phone / response time / password only.
 * Does **not** modify Prisma `PaymentMethod` rows — player-facing rails live in `User.paymentMethods` JSON (`/api/agent/settings/payments`).
 */
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const { agentId, email, phone, responseMinutes, password } = body;

    if (!agentId) return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });

    const minutes = Number(responseMinutes);
    if (!EXECUTION_TIME_OPTIONS.includes(minutes)) {
      return NextResponse.json({ message: "وقت الاستجابة غير صالحة" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: String(email ?? "").trim().toLowerCase(),
        NOT: { agentProfile: { id: agentId } },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ message: "هذا البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({ where: { id: agentId } });
      if (!agent) throw new Error("Agent not found");

      const userUpdate: { email: string; passwordHash?: string } = {
        email: String(email ?? "").trim().toLowerCase(),
      };
      if (password && String(password).length >= 6) {
        userUpdate.passwordHash = await hashPassword(String(password));
      }

      await tx.user.update({
        where: { id: agent.userId },
        data: userUpdate,
      });

      return await tx.agent.update({
        where: { id: agentId },
        data: {
          email: String(email ?? "").trim().toLowerCase(),
          phone: String(phone ?? "").trim(),
          responseMinutes: minutes,
          defaultExecutionTimeMinutes: minutes,
        },
        include: { user: { select: USER_SELECT_SAFE_RELATION } },
      });
    });

    return NextResponse.json({ message: "تم تحديث إعدادات الوكيل ✅", agent: result });
  } catch (error: unknown) {
    console.error("AGENT SETTINGS ERROR:", error);
    return NextResponse.json({ message: "فشل تحديث الإعدادات" }, { status: 500 });
  }
}
