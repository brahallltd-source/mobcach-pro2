import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import {
  AGENT_EXECUTION_TIME_VALUES,
  agentPaymentSettingsSchema,
  parseAgentPaymentMethodsJson,
  parseExecutionTime,
} from "@/lib/agent-payment-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgentSession(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") {
    return null;
  }
  const agentId = session.agentProfile?.id ?? null;
  if (!agentId) return null;
  return { session, agentId, userId: session.id };
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }
    const session = await getSessionUserFromCookies();
    const ctx = requireAgentSession(session);
    if (!ctx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const suspended = await rejectAgentIfSuspended(prisma, ctx.userId);
    if (suspended) return suspended;

    const userRow = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { executionTime: true, paymentMethods: true },
    });

    const executionTime = parseExecutionTime(userRow?.executionTime ?? undefined);
    const paymentMethods = parseAgentPaymentMethodsJson(userRow?.paymentMethods);

    return NextResponse.json({
      success: true,
      executionTime,
      paymentMethods,
      executionTimeOptions: [...AGENT_EXECUTION_TIME_VALUES],
    });
  } catch (e) {
    console.error("settings/payments GET:", e);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }
    const session = await getSessionUserFromCookies();
    const ctx = requireAgentSession(session);
    if (!ctx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, ctx.userId);
    if (suspended) return suspended;

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = agentPaymentSettingsSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.paymentMethods?.[0]
        ?? parsed.error.flatten().fieldErrors.executionTime?.[0]
        ?? parsed.error.errors[0]?.message
        ?? "بيانات غير صالحة";
      return NextResponse.json({ message: msg, issues: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        executionTime: parsed.data.executionTime,
        paymentMethods: parsed.data.paymentMethods as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, message: "تم حفظ إعدادات الدفع" });
  } catch (e) {
    console.error("settings/payments POST:", e);
    return NextResponse.json({ message: "فشل الحفظ" }, { status: 500 });
  }
}
