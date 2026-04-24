import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications";
import { createWalletIfMissing } from "@/lib/wallet";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

// دالة بناء الرسالة للوكيل
function buildAgentApprovalMessage(payload: {
  username: string;
  email: string;
}) {
  const { username, email } = payload;
  return `مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: استخدم نفس كلمة المرور التي سجلت بها
- Email: ${email}

يرجى الحفاظ على هذه البيانات بشكل سري.`;
}

// جلب جميع الطلبات
export async function GET() {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { success: false, data: [] });
    }

  try {
    const prisma = getPrisma();
    const applications = await prisma.agentApplication.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Error fetching applications" }, { status: 500 });
  }
}

// معالجة القبول أو الرفض
export async function POST(req: Request) {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { success: false });
    }

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const { agentId, action } = body as { agentId?: string; action?: "approve" | "reject" };

    if (!agentId || !action) {
      return NextResponse.json({ success: false, message: "Missing data" }, { status: 400 });
    }

    const application = await prisma.agentApplication.findUnique({
      where: { id: String(agentId) },
    });

    if (!application) {
      return NextResponse.json({ success: false, message: "Application not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // حالة الرفض
      if (action === "reject") {
        const rejected = await tx.agentApplication.update({
          where: { id: String(agentId) },
          data: { status: "rejected", updatedAt: new Date() },
        });
        await tx.user.update({
          where: { id: application.userId },
          data: { applicationStatus: "REJECTED" },
        });
        return { mode: "rejected" as const, application: rejected };
      }

      // حالة القبول:
      // 1. التأكد من وجود المستخدم أو إنشاؤه
      let user = await tx.user.findUnique({
        where: { id: application.userId },
      });

      if (!user) {
        user = await tx.user.findFirst({
          where: { OR: [{ email: application.email }, { username: application.username }] },
        });
      }

      if (!user) {
        const appData = application as any;
        let finalPasswordHash = "";
        
        // 🟢 الإصلاح الذكي والمهم هنا:
        // نتحقق أولاً هل المودباس ديجا مشفر في قاعدة البيانات (يبدأ بـ $2)
        const rawPassword = appData.passwordHash || appData.password || "";
        
        if (rawPassword.startsWith("$2")) {
          // إذا كان ديجا مشفر، نأخذه كما هو
          finalPasswordHash = rawPassword;
        } else if (rawPassword) {
          // إذا كان نص عادي، نقوم بتشفيره
          finalPasswordHash = await hashPassword(rawPassword);
        } else {
          // احتياط أخير إذا كان المودباس مفقود تماماً
          finalPasswordHash = await hashPassword("123456"); 
        }

        user = await tx.user.create({
          data: {
            email: application.email,
            username: application.username,
            passwordHash: finalPasswordHash,
            role: "AGENT",
            applicationStatus: "APPROVED",
            status: "ACTIVE",
            frozen: false,
          },
        });
      }

      // 2. إدارة ملف الوكيل (Agent Profile)
      let agentRecord = await tx.agent.findUnique({
        where: { userId: user.id }
      });

      if (!agentRecord) {
        agentRecord = await tx.agent.create({
          data: {
            userId: user.id,
            fullName: application.fullName,
            username: application.username,
            email: application.email,
            phone: application.phone,
            country: application.country || "Morocco",
            status: "active",
            availableBalance: 0,
            online: true,
            verified: false
          }
        });
      }

      // 3. فتح الحساب بعد الموافقة: الطلب كان كوكيل (AGENT) + PENDING؛ نحدّث حالة الطلب فقط هنا
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          applicationStatus: "APPROVED",
        },
      });

      // 4. تحديث حالة الطلب
      const approvedApplication = await tx.agentApplication.update({
        where: { id: String(agentId) },
        data: {
          status: "approved",
          userId: user.id,
          updatedAt: new Date(),
        },
      });

      return {
        mode: "approved" as const,
        application: approvedApplication,
        user: updatedUser,
        agent: agentRecord,
      };
    });

    if (result.mode === "rejected") {
      return NextResponse.json({ success: true, message: "Agent application rejected successfully" });
    }

    // تفعيل العمليات الجانبية (محفظة، تنبيهات)
    try {
      await createWalletIfMissing(result.agent.id);
      await createNotification({
        targetRole: "agent",
        targetId: result.agent.id,
        title: "Application approved",
        message: "Your account has been upgraded to agent successfully.",
      });
    } catch (e) {
      console.warn("Notification/Wallet skipped:", e);
    }

    const officialMessage = buildAgentApprovalMessage({
      username: result.user.username,
      email: result.user.email,
    });

    return NextResponse.json({
      success: true,
      message: "Agent application approved successfully",
      officialMessage,
      agentId: result.agent.id,
      userId: result.user.id,
    });

  } catch (error: any) {
    console.error("AGENT APPROVAL ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}