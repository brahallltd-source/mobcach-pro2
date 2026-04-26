import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_OPTIONS = [
  "تأخر الشحن",
  "مشكلة في السحب",
  "شكوى ضد وكيل",
  "استفسار عام",
  "أخرى",
] as const;

const ticketBodySchema = z.object({
  subject: z.enum(SUBJECT_OPTIONS),
  message: z.string().trim().min(10, "الرسالة قصيرة").max(8000, "الرسالة طويلة"),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = ticketBodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.message?.[0] || parsed.error.flatten().fieldErrors.subject?.[0] || "بيانات غير صالحة";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
    }

    const ticket = await prisma.playerSupportTicket.create({
      data: {
        userId: session.id,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: "OPEN",
      },
      select: { id: true, createdAt: true },
    });

    await notifyAllActiveAdmins({
      title: "تذكرة دعم من لاعب",
      message: `${session.email}: ${parsed.data.subject}`,
    });

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      message: "تم إنشاء التذكرة",
    });
  } catch (e) {
    console.error("POST /api/support", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
