import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { registerPlayerCore } from "@/lib/register-player-core";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

/**
 * Same handler as `POST /api/register` (canonical). Exposed for clients that call `/api/auth/register`.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const out = await registerPlayerCore(body);
    if (out.ok === false) {
      console.error("[REGISTER_ERROR]", out.message);
      return jsonError(out.message, out.status);
    }
    return NextResponse.json({
      success: true,
      role: out.user.role,
      user: {
        id: out.user.id,
        email: out.user.email,
        username: out.user.username,
        role: out.user.role.toLowerCase(),
        status: out.user.status,
        assigned_agent_id: out.user.assigned_agent_id,
      },
      nextStep: out.nextStep,
    });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const msg = "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.";
      return jsonError(msg, 400);
    }
    if (error instanceof ZodError) {
      const msg = error.errors[0]?.message || "بيانات غير صالحة";
      return jsonError(msg, 400);
    }
    const msg = error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الحساب.";
    return jsonError(msg, 400);
  }
}
