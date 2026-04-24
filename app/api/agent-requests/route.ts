import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { agentRequestKycSchema, assertAdultDateString } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Player requests to become an agent — sets `User.pendingAgentRequest`. Optional JSON body stores KYC on `User`. */
export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    const roleU = String(session.role ?? "").trim().toUpperCase();
    if (roleU !== "PLAYER") {
      return NextResponse.json({ message: "للّاعبين فقط" }, { status: 403 });
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
      select: { id: true, email: true, pendingAgentRequest: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
    }
    if (String(user.role).toUpperCase() === "AGENT") {
      return NextResponse.json({ message: "أنت بالفعل وكيل" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingAgentRequest: true,
        ...(kycUpdate
          ? {
              country: kycUpdate.country,
              city: kycUpdate.city,
              dateOfBirth: kycUpdate.dateOfBirth,
            }
          : {}),
      },
    });

    await createNotification({
      targetRole: "admin",
      targetId: "admin",
      title: "طلب التحويل إلى وكيل",
      message: `اللاعب ${user.email} طلب الانضمام كوكيل (قيد المراجعة).`,
    });

    return NextResponse.json({
      ok: true,
      status: "قيد المراجعة",
      message: "تم استلام طلبك. فريقنا سيراجعه قريباً.",
    });
  } catch (e) {
    console.error("POST /api/agent-requests", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
