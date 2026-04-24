import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { hashPassword } from "@/lib/security";
import { getPrisma } from "@/lib/db";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";

export const runtime = "nodejs";

function buildPlayerMessage(payload: {
  username: string;
  password: string;
  email: string;
  whatsapp: string;
}) {
  const { username, password, email, whatsapp } = payload;

  return `Hello, your account has been created successfully.

Login credentials:
- Username: ${username}
- Password: ${password}

Contact details:
- Email: ${email}
- WhatsApp: ${whatsapp}

Please do not share these credentials with anyone.
These credentials are valid for GoSport365 and GoSport365 MobCash.

------------------------------

مرحبًا، تم إنشاء حسابك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}

بيانات التواصل:
- Email: ${email}
- WhatsApp: ${whatsapp}

يرجى عدم مشاركة هذه المعلومات مع أي شخص.
هذه البيانات صالحة لتسجيل الدخول عبر GoSport365 و GoSport365 MobCash.`;
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const agentEmail = String(body.agentEmail || "").trim().toLowerCase();
    const firstName = String(body.first_name || body.firstName || "").trim();
    const lastName = String(body.last_name || body.lastName || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

if (!password) {
  return NextResponse.json(
    { message: "Password is required" },
    { status: 400 }
  );
}
    const phone = String(body.phone || "").trim();
    const country = String(body.country || "Morocco").trim();
    const city = String(body.city || "").trim();

    if (!agentEmail || !username || !email) {
      return NextResponse.json(
        { message: "agentEmail, username and email are required" },
        { status: 400 }
      );
    }

    const agentUser = await prisma.user.findFirst({
      where: {
        email: agentEmail,
        role: "AGENT",
      },
      select: {
        id: true,
        agentId: true,
        email: true,
      },
    });

    if (!agentUser?.agentId) {
      return NextResponse.json(
        { message: "Agent not found" },
        { status: 404 }
      );
    }

    const maintenanceBlock = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenanceBlock) return maintenanceBlock;

    const suspendedBlock = await rejectAgentIfSuspended(prisma, agentUser.id);
    if (suspendedBlock) return suspendedBlock;

    const existingEmail = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 400 }
      );
    }

    const existingUsername = await prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        { message: "Username already exists" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneWithCountry(phone, country);
    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: "PLAYER",
          frozen: false,
          playerStatus: "active",
          assignedAgentId: agentUser.agentId,
        },
      });

      const player = await tx.player.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          username,
          phone: normalizedPhone,
          city: city || null,
          country: country || null,
          dateOfBirth: null,
          status: "active",
          assignedAgentId: agentUser.agentId,
          referredBy: null,
        },
      });

      const messageText = buildPlayerMessage({
        username,
        password,
        email,
        whatsapp: normalizedPhone,
      });

      const activation = await tx.activation.create({
        data: {
          agentId: agentUser.agentId,
          playerUserId: user.id,
          playerEmail: email,
          username,
          passwordPlain: password,
          whatsapp: normalizedPhone || null,
          status: "sent",
          messageText,
          activatedAt: new Date(),
          sentAt: new Date(),
        },
      });

      return { user, player, activation, messageText };
    });

    await createNotification({
      targetRole: "player",
      targetId: result.user.id,
      title: "Account created by your agent",
      message:
        "Your player account has been created and activated directly by your agent.",
    });

    return NextResponse.json({
      success: true,
      message: "Player created, activated and linked successfully ✅",
      user: result.user,
      player: result.player,
      activation: result.activation,
      credentials: {
        username: result.user.username,
        password,
        messageText: result.messageText,
      },
    });
  } catch (error) {
    console.error("ADD PLAYER ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}