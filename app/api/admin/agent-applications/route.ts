import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications";
import { createWalletIfMissing } from "@/lib/wallet";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

function buildAgentApprovalMessage(payload: {
  username: string;
  email: string;
}) {
  const { username, email } = payload;

  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${username}
- Password: Use the same password you registered with
- Email: ${email}

Please keep these credentials private.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: استخدم نفس كلمة المرور التي سجلت بها
- Email: ${email}

يرجى الحفاظ على هذه البيانات بشكل سري.`;
}

export async function GET() {
  const access = await requireAdminPermission("agents");

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message },
      { status: access.status }
    );
  }

  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const applications = await prisma.agentApplication.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    console.error("GET AGENT APPLICATIONS ERROR:", error);
    return NextResponse.json(
      { success: false, message: `Something went wrong
        We could not complete your request right now. Please try again.`},
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("agents");

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message },
      { status: access.status }
    );
  }

  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { agentId, action } = body as {
      agentId?: string;
      action?: "approve" | "reject";
    };

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, message: "Missing data" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }

    const application = await prisma.agentApplication.findUnique({
      where: { id: String(agentId) },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, message: "Application not found" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (action === "reject") {
        const rejected = await tx.agentApplication.update({
          where: { id: String(agentId) },
          data: { status: "rejected", updatedAt: new Date() },
        });

        return { mode: "rejected" as const, application: rejected };
      }

      let user = await tx.user.findUnique({
        where: { id: application.userId },
      });

      if (!user) {
        user = await tx.user.findFirst({
          where: {
            OR: [
              { email: application.email },
              { username: application.username },
            ],
          },
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
            frozen: false,
            playerStatus: "inactive",
          },
        });
      }

      const existingAgent = await tx.agent.findFirst({
        where: {
          OR: [
            { email: application.email },
            { username: application.username },
          ],
        },
      });

      let agentRecord;

      if (existingAgent) {
        agentRecord = await tx.agent.update({
          where: { id: existingAgent.id },
          data: {
            fullName: application.fullName,
            username: application.username,
            email: application.email,
            phone: application.phone,
            country: application.country || "Morocco",
            note: application.note || null,
            status: "account_created",
            online: true,
            updatedAt: new Date(),
          },
        });
      } else {
        agentRecord = await tx.agent.create({
          data: {
            fullName: application.fullName,
            username: application.username,
            email: application.email,
            phone: application.phone,
            country: application.country || "Morocco",
            note: application.note || null,
            status: "account_created",
            online: true,
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          role: "AGENT",
          frozen: false,
          agentId: agentRecord.id,
        },
      });

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
      await createNotification({
        targetRole: "player",
        targetId: result.application.userId,
        title: "Application rejected",
        message: "Your agent application has been rejected.",
      });

      return NextResponse.json({
        success: true,
        message: "Agent application rejected successfully",
        data: result.application,
      });
    }

    await createWalletIfMissing(result.agent.id);

    const officialMessage = buildAgentApprovalMessage({
      username: result.user.username,
      email: result.user.email,
    });

    await createNotification({
      targetRole: "agent",
      targetId: result.agent.id,
      title: "Application approved",
      message: "Your account has been upgraded to agent successfully.",
    });

    return NextResponse.json({
      success: true,
      message: "Agent application approved successfully",
      data: result.application,
      officialMessage,
      agent: result.agent,
      userId: result.user.id,
    });
  } catch (error) {
    console.error("AGENT APPROVAL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message: `Something went wrong
        We could not complete your request right now. Please try again.`,
      },
      { status: 500 }
    );
  }
}