import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { notifyAllAdminsNewAgentApplication } from "@/lib/in-app-notifications";
import {
  agentRegisterSchema,
  extractNationalPhoneForAgentSchema,
  formatAgentRegisterFieldErrors,
  normalizeAgentBirthDateInput,
} from "@/lib/validations/agent-register";
import { resolveAgentReferrerUserId } from "@/lib/agent-subagent-bonus";

export const runtime = "nodejs";

function buildRegisterPayload(raw: Record<string, unknown>) {
  const country = String(raw.country ?? "Morocco").trim();
  return {
    fullName: String(raw.fullName ?? raw.full_name ?? "").trim(),
    username: String(raw.username ?? "").trim(),
    email: String(raw.email ?? "").trim().toLowerCase(),
    password: String(raw.password ?? "").trim(),
    confirmPassword: String(raw.confirmPassword ?? raw.confirm_password ?? "").trim(),
    birthDate: normalizeAgentBirthDateInput(raw.birthDate ?? raw.birth_date),
    country,
    city: String(raw.city ?? "").trim(),
    phoneNumber: extractNationalPhoneForAgentSchema(
      String(raw.phoneNumber ?? raw.phone ?? ""),
      country || "Morocco",
    ),
    note: raw.note != null && String(raw.note).trim() !== "" ? String(raw.note).trim() : undefined,
  };
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const rawBody = (await req.json()) as Record<string, unknown>;

    const accountTypeRaw = String(rawBody.accountType || rawBody.account_type || "AGENT")
      .trim()
      .toUpperCase();
    if (accountTypeRaw !== "AGENT") {
      return NextResponse.json(
        {
          success: false,
          message:
            accountTypeRaw === "PLAYER"
              ? "Player accounts are created via player registration, not this form."
              : "Invalid accountType. Use AGENT for agent applications.",
        },
        { status: 400 }
      );
    }

    const parsed = agentRegisterSchema.safeParse(buildRegisterPayload(rawBody));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          fieldErrors: formatAgentRegisterFieldErrors(parsed.error),
        },
        { status: 422 }
      );
    }

    const { password, phoneNumber, birthDate, fullName, username, email, country, city, note } =
      parsed.data;

    const refRaw = String(rawBody.ref ?? rawBody.referrer_invite ?? rawBody.invite_code ?? "").trim();
    const referrerFromRef = refRaw ? await resolveAgentReferrerUserId(prisma, refRaw) : null;

    const existingPending = await prisma.agentApplication.findFirst({
      where: {
        OR: [{ email }, { username }],
        status: "pending",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { success: false, message: "You already have a pending application" },
        { status: 400 }
      );
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (!user) {
      const passwordHash = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: "AGENT",
          applicationStatus: "PENDING",
          frozen: false,
          playerStatus: null,
          ...(referrerFromRef ? { referredById: referrerFromRef } : {}),
        },
      });
    } else if (user.role === "AGENT") {
      return NextResponse.json(
        { success: false, message: "This account is already an agent" },
        { status: 400 }
      );
    } else if (String(user.role).toUpperCase() === "PLAYER") {
      const passwordHash = await hashPassword(password);
      const refToSet =
        referrerFromRef && referrerFromRef !== user.id ? referrerFromRef : undefined;
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          role: "AGENT",
          applicationStatus: "PENDING",
          playerStatus: null,
          assignedAgentId: null,
          ...(refToSet ? { referredById: refToSet } : {}),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, message: "This account cannot apply as an agent" },
        { status: 400 }
      );
    }

    const application = await prisma.agentApplication.create({
      data: {
        userId: user.id,
        fullName,
        username,
        email,
        phone: phoneNumber,
        country,
        city,
        birthDate,
        note: note && String(note).trim() !== "" ? String(note).trim() : null,
        status: "pending",
      },
    });

    try {
      await notifyAllAdminsNewAgentApplication({ applicantUsername: username });
    } catch (e) {
      console.error("New agent application admin notification:", e);
    }

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error("APPLY AGENT ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Something went wrong
We could not complete your request right now. Please try again.`,
      },
      { status: 500 }
    );
  }
}
