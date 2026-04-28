import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { notifyAllAdminsNewAgentApplication } from "@/lib/in-app-notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { agentRequestKycSchema, assertAdultDateString } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Player requests to become an agent — canonical flow via `AgentApplication` + `User.applicationStatus`. */
export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    const roleU = String(session.role ?? "").trim().toUpperCase();
    if (roleU !== "PLAYER" && roleU !== "AGENT") {
      return NextResponse.json({ message: "غير مسموح" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const hasKyc =
      String(body.country ?? "").trim().length >= 2 &&
      String(body.city ?? "").trim().length >= 2 &&
      String(body.dateOfBirth ?? "").trim().length >= 1;

    let kycUpdate: { country: string; city: string; dateOfBirth: Date } | null = null;
    if (hasKyc) {
      const kyc = agentRequestKycSchema.safeParse(body);
      if (!kyc.success) {
        const flat = kyc.error.flatten().fieldErrors;
        const first =
          (Object.values(flat).find((a) => a?.length)?.[0] as string | undefined) ??
          kyc.error.errors[0]?.message ??
          "بيانات التحقق غير صالحة";
        return NextResponse.json({ message: first }, { status: 400 });
      }
      if (!assertAdultDateString(kyc.data.dateOfBirth, 18)) {
        return NextResponse.json(
          { message: "عذراً، يجب أن يكون عمرك 18 عاماً أو أكثر" },
          { status: 400 }
        );
      }
      kycUpdate = {
        country: kyc.data.country,
        city: kyc.data.city,
        dateOfBirth: new Date(kyc.data.dateOfBirth),
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        country: true,
        city: true,
        dateOfBirth: true,
      },
    });
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
    }

    const existingPending = await prisma.agentApplication.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (existingPending) {
      return NextResponse.json({
        ok: true,
        status: "pending",
        message: "لديك طلب قيد المراجعة بالفعل.",
        application: existingPending,
      });
    }

    const fullName = String(body.fullName ?? body.name ?? user.username ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const username = String(body.username ?? user.username ?? "").trim();
    const email = String(body.email ?? user.email ?? "").trim().toLowerCase();
    const country = String(body.country ?? kycUpdate?.country ?? user.country ?? "").trim() || "Morocco";
    const city = String(body.city ?? kycUpdate?.city ?? user.city ?? "").trim();
    const note = String(body.note ?? "").trim();
    const birthDate = kycUpdate?.dateOfBirth ?? user.dateOfBirth ?? null;

    if (!fullName || !username || !email || !phone || !city || !birthDate) {
      return NextResponse.json(
        { message: "بيانات الطلب ناقصة. يرجى تعبئة الاسم والهاتف والمدينة وتاريخ الميلاد." },
        { status: 400 }
      );
    }

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.agentApplication.create({
        data: {
          userId: user.id,
          fullName,
          username,
          email,
          phone,
          country,
          city,
          birthDate,
          note: note || null,
          status: "pending",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: "AGENT",
          applicationStatus: "PENDING",
          pendingAgentRequest: true,
          country,
          city,
          dateOfBirth: birthDate,
        },
      });

      return created;
    });

    await notifyAllAdminsNewAgentApplication({
      applicantUsername: username || email,
    });

    return NextResponse.json({
      ok: true,
      status: "pending",
      message: "تم استلام طلبك. تمت إحالته للإدارة وهو الآن قيد المراجعة.",
      application,
    });
  } catch (e) {
    console.error("POST /api/agent-requests", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
