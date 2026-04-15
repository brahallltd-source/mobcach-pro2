import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
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
  const access = await requireAdminPermission("agents");
  if (!access.ok) {
    return NextResponse.json({ success: false, message: access.message }, { status: access.status });
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
  const access = await requireAdminPermission("agents");
  if (!access.ok) {
    return NextResponse.json({ success: false, message: access.message }, { status: access.status });
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
        const passwordHash = await hashPassword("123456");
        user = await tx.user.create({
          data: {
            email: application.email,
            username: application.username,
            passwordHash,
            role: "PLAYER",
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
        // ✅ الإصلاح النهائي: كنعطيو كاع الحقول لي طالبة السكيما ديالك
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

      // 3. تحديث دور المستخدم ليصبح وكيل
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          role: "AGENT",
          status: "ACTIVE",
          frozen: false,
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