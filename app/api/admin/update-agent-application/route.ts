import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications";
import { createWalletIfMissing } from "@/lib/wallet";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";


function buildAgentApprovalMessage(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const { username, email, password } = payload;

  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${username}
- Password: ${password}
- Email: ${email}

Please keep these credentials private.
These credentials are valid for GoSport365 MobCash.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}
- Email: ${email}

يرجى الحفاظ على هذه البيانات بشكل سري.
هذه البيانات صالحة للدخول إلى GoSport365 MobCash.`;
}

async function resolveUniqueUsername(
  prisma: ReturnType<typeof getPrisma>,
  base: string,
  email: string
) {
  if (!prisma) return base;

  const cleanBase = (base || email.split("@")[0] || "agent").trim();
  let candidate = cleanBase;
  let counter = 1;

  while (true) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true, email: true },
    });

    if (!exists || exists.email === email) {
      return candidate;
    }

    counter += 1;
    candidate = `${cleanBase}${counter}`;
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
    const { agentId, action } = await req.json();

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, message: "agentId and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: String(agentId) },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent application not found" },
        { status: 404 }
      );
    }

    if (action === "reject") {
      const updated = await prisma.agent.update({
        where: { id: String(agentId) },
        data: {
          status: "rejected",
          online: false,
          updatedAt: new Date(),
        },
      });

      await createNotification({
        targetRole: "agent",
        targetId: updated.id,
        title: "Application rejected",
        message: "Your agent application has been rejected.",
      });

      return NextResponse.json({
        success: true,
        message: "Agent application rejected successfully",
        agent: updated,
      });
    }

    const defaultPassword = "123456";

    const result = await prisma.$transaction(async (tx) => {
      const updatedAgent = await tx.agent.update({
        where: { id: String(agentId) },
        data: {
          status: "account_created",
          online: true,
          updatedAt: new Date(),
        },
      });

      const existingByEmail = await tx.user.findUnique({
        where: { email: updatedAgent.email },
      });

      const uniqueUsername = await resolveUniqueUsername(
        prisma,
        updatedAgent.username || updatedAgent.email.split("@")[0],
        updatedAgent.email
      );

      if (existingByEmail) {
        const updatedUser = await tx.user.update({
          where: { id: existingByEmail.id },
          data: {
            role: "AGENT",
            frozen: false,
            agentId: updatedAgent.id,
            assignedAgentId: null,
            username: uniqueUsername,
          },
        });

        return {
          agent: updatedAgent,
          user: updatedUser,
          mode: "updated-existing-user" as const,
        };
      }

      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const createdUser = await tx.user.create({
        data: {
          email: updatedAgent.email,
          username: uniqueUsername,
          passwordHash,
          role: "AGENT",
          frozen: false,
          agentId: updatedAgent.id,
          playerStatus: null,
          assignedAgentId: null,
          permissions: null,
        },
      });

      return {
        agent: updatedAgent,
        user: createdUser,
        mode: "created-new-user" as const,
      };
    });

    await createWalletIfMissing(result.agent.id);

    const officialMessage = buildAgentApprovalMessage({
      username: result.user.username,
      email: result.user.email,
      password: defaultPassword,
    });

    await createNotification({
      targetRole: "agent",
      targetId: result.agent.id,
      title: "Application approved",
      message: "Your agent account is now approved and created.",
    });

    return NextResponse.json({
      success: true,
      message: "Agent approved successfully ✅",
      agent: result.agent,
      userId: result.user.id,
      syncMode: result.mode,
      officialMessage,
    });
  } catch (error) {
    console.error("UPDATE AGENT APPLICATION ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}