import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { registerPlayerApiSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/security";
import { createGoSportPlayer } from "@/lib/gosport-api";
import { createNotification } from "@/lib/notifications";
import { sendWhatsAppCredentials } from "@/lib/whatsapp";

export type RegisterPlayerCoreSuccess = {
  ok: true;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    /** `User.status` (e.g. ACTIVE, PENDING_APPROVAL, PENDING_AGENT). */
    status: string | null;
    assigned_agent_id: string | null;
  };
  nextStep: string;
};

export type RegisterPlayerCoreFailure = {
  ok: false;
  status: number;
  message: string;
};

export type RegisterPlayerCoreResult = RegisterPlayerCoreSuccess | RegisterPlayerCoreFailure;

/**
 * Creates a PLAYER account (used by `POST /api/auth/register`).
 * Rejects `body.role` unless it is PLAYER (case-insensitive) to block AGENT injection via public forms.
 */
export async function registerPlayerCore(
  body: Record<string, unknown>
): Promise<RegisterPlayerCoreResult> {
  const prisma = getPrisma();
  if (!prisma) {
    return { ok: false, status: 500, message: "Database not available" };
  }

  const roleClaim = String(body.role ?? "PLAYER").trim().toUpperCase();
  if (roleClaim !== "PLAYER") {
    return {
      ok: false,
      status: 403,
      message: "تسجيل حساب وكيل يتم عبر صفحة التسجيل المخصصة للوكلاء فقط.",
    };
  }

  const parsed = registerPlayerApiSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      (Object.values(flat).find((a) => a?.length)?.[0] as string | undefined) ??
      parsed.error.errors[0]?.message ??
      "بيانات غير صالحة";
    return { ok: false, status: 400, message: first };
  }

  const {
    name,
    email,
    phone,
    password,
    country,
    city,
    username,
    inviteCode: inviteParsed,
    agent_code: agentParsed,
    selectedAgentId: selectedAgentParsed,
  } = parsed.data;

  const inviteCodeRaw = String(inviteParsed ?? "").trim();
  const safeCountry = String(country ?? "").trim() || "Morocco";
  const safeCity = String(city ?? "").trim() || "—";
  const safeName = String(name ?? "").trim() || username;
  const nameParts = safeName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const safeEmail =
    String(email ?? "").trim().toLowerCase() ||
    `${username.toLowerCase().replace(/\s+/g, "_")}@gs365cash.local`;

  const existingUsername = await prisma.user.findUnique({
    where: { username },
    include: { player: true },
  });
  if (existingUsername && String(existingUsername.role ?? "").trim().toUpperCase() !== "PLAYER") {
    return {
      ok: false,
      status: 400,
      message: "اسم المستخدم مستخدم بالفعل.",
    };
  }
  if (existingUsername && !existingUsername.player) {
    return {
      ok: false,
      status: 400,
      message: "تعذر إكمال العملية: حساب اللاعب غير مكتمل.",
    };
  }

  let assignedAgentId: string | null = null;
  let assignedAgentUserId: string | null = null;
  let nextStep = "/player/dashboard";

  const linkableAgentStatuses = ["ACTIVE", "active", "account_created", "pending"];

  /** Resolve agent strictly; no pending link states in instant automation flow. */
  if (inviteCodeRaw !== "") {
    const inviter = await prisma.user.findUnique({
      where: { inviteCode: inviteCodeRaw },
      include: { agentProfile: true },
    });
    const inviterRole = String(inviter?.role ?? "").trim().toUpperCase();
    if (!inviter || inviterRole !== "AGENT" || !inviter.agentProfile) {
      return {
        ok: false,
        status: 400,
        message: "كود الدعوة غير صحيح أو غير موجود",
      };
    }
    if (!linkableAgentStatuses.includes(String(inviter.agentProfile.status ?? ""))) {
      return {
        ok: false,
        status: 400,
        message: "الوكيل المرتبط بهذا الرابط غير متاح حالياً",
      };
    }
    assignedAgentId = inviter.agentProfile.id;
    assignedAgentUserId = inviter.id;
  } else {
    const selectedAgentId = String(selectedAgentParsed ?? "").trim();

    if (selectedAgentId !== "") {
      const picked = await prisma.agent.findFirst({
        where: {
          id: selectedAgentId,
          status: { in: linkableAgentStatuses },
        },
      });
      if (!picked) {
        return {
          ok: false,
          status: 400,
          message: "الوكيل غير متاح أو غير موجود",
        };
      }
      assignedAgentId = picked.id;
      assignedAgentUserId = picked.userId;
    } else {
      const agentInput = String(agentParsed ?? "").trim();
      if (agentInput === "") {
        return {
          ok: false,
          status: 400,
          message: "يرجى اختيار وكيل أو إدخال كود وكيل صالح.",
        };
      }
      const agent = await prisma.agent.findFirst({
        where: {
          OR: [
            { username: agentInput },
            { referralCode: agentInput },
            { id: agentInput },
            { user: { inviteCode: agentInput } },
          ],
          status: { in: linkableAgentStatuses },
        },
      });

      if (agent) {
        assignedAgentId = agent.id;
        assignedAgentUserId = agent.userId;
      } else {
        return {
          ok: false,
          status: 400,
          message: "كود الوكيل غير صحيح أو الوكيل غير موجود",
        };
      }
    }
  }

  if (!assignedAgentId || !assignedAgentUserId) {
    return {
      ok: false,
      status: 400,
      message: "تعذر تحديد الوكيل المسؤول عن الحساب.",
    };
  }

  const existingUser = existingUsername;
  const existingAssignedAgentId = String(
    existingUser?.assignedAgentId ?? existingUser?.player?.assignedAgentId ?? "",
  ).trim();
  const incomingAgentId = String(assignedAgentId).trim();
  const isExistingSameAgent = Boolean(existingUser && existingAssignedAgentId && existingAssignedAgentId === incomingAgentId);
  const shouldCreateExternal = !existingUser || !isExistingSameAgent;
  const passwordHash = await hashPassword(password);

  const emailOwner = await prisma.user.findUnique({
    where: { email: safeEmail },
    select: { id: true },
  });
  if (!existingUser && emailOwner) {
    return {
      ok: false,
      status: 400,
      message: "البريد الإلكتروني أو اسم المستخدم موجود مسبقاً",
    };
  }
  if (existingUser && emailOwner && emailOwner.id !== existingUser.id) {
    return {
      ok: false,
      status: 400,
      message: "البريد الإلكتروني مستخدم من قبل حساب آخر.",
    };
  }

  let resolvedGoSportId = String(
    existingUser?.player?.goSportId ??
      (String(existingUser?.player?.gosportUsername ?? "").trim().match(/^\d+$/)
        ? String(existingUser?.player?.gosportUsername ?? "").trim()
        : ""),
  ).trim();

  if (shouldCreateExternal) {
    const caseLabel = existingUser ? "CASE_1_EXISTING_USER_NEW_AGENT" : "CASE_1_NEW_USER";
    console.log("[registerPlayerCore]", caseLabel, {
      username,
      existingUserId: existingUser?.id ?? null,
      fromAgentId: existingAssignedAgentId || null,
      toAgentId: incomingAgentId,
    });

    const goSport = await createGoSportPlayer(assignedAgentUserId, username, password);
    if (!goSport.success) {
      return {
        ok: false,
        status: 400,
        message: goSport.error || "فشل إنشاء حساب GoSport365.",
      };
    }
    const createdGoSportId = String(goSport.goSportId ?? "").trim();
    if (!createdGoSportId) {
      return {
        ok: false,
        status: 500,
        message: "تعذر استخراج معرف GoSport بعد إنشاء الحساب.",
      };
    }
    resolvedGoSportId = createdGoSportId;
  } else {
    console.log("[registerPlayerCore] CASE_2_EXISTING_USER_SAME_AGENT", {
      username,
      existingUserId: existingUser?.id ?? null,
      agentId: incomingAgentId,
      goSportIdPreserved: resolvedGoSportId || null,
    });
  }

  const normalizedPlayerPhone = normalizePhoneWithCountry(phone, safeCountry);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let user = existingUser;
      let player = existingUser?.player ?? null;

      if (!user) {
        user = await tx.user.create({
          data: {
            email: safeEmail,
            username,
            passwordHash,
            role: "PLAYER",
            applicationStatus: "NONE",
            status: "ACTIVE",
            playerStatus: "active",
            assignedAgentId,
            country: safeCountry,
            city: safeCity,
          },
          include: { player: true },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            email: safeEmail,
            passwordHash,
            status: "ACTIVE",
            playerStatus: "active",
            assignedAgentId,
            country: safeCountry,
            city: safeCity,
          },
          include: { player: true },
        });
      }

      if (!player) {
        player = await tx.player.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            username,
            phone: normalizedPlayerPhone,
            status: "active",
            goSportId: resolvedGoSportId || null,
            assignedAgentId,
            country: safeCountry,
            city: safeCity,
            dateOfBirth: null,
          },
        });
      } else {
        player = await tx.player.update({
          where: { id: player.id },
          data: {
            firstName,
            lastName,
            phone: normalizedPlayerPhone,
            status: "active",
            ...(resolvedGoSportId ? { goSportId: resolvedGoSportId } : {}),
            assignedAgentId,
            country: safeCountry,
            city: safeCity,
          },
        });
      }

      await tx.agentCustomer.upsert({
        where: {
          agentId_playerId: {
            agentId: assignedAgentId,
            playerId: player.id,
          },
        },
        update: { status: "CONNECTED" },
        create: {
          agentId: assignedAgentId,
          playerId: player.id,
          status: "CONNECTED",
        },
      });

      return { user, player };
    });

    try {
      const selectedAgent = await prisma.agent.findUnique({
        where: { id: assignedAgentId },
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          user: {
            select: {
              id: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      const missingAgentFields: string[] = [];
      if (!selectedAgent) {
        missingAgentFields.push("agent_record");
      } else {
        if (!String(selectedAgent.fullName ?? "").trim() && !String(selectedAgent.username ?? "").trim()) {
          missingAgentFields.push("agent_name_or_username");
        }
        const hasAgentPhone =
          String(selectedAgent.phone ?? "").trim() || String(selectedAgent.user?.phone ?? "").trim();
        if (!hasAgentPhone) {
          missingAgentFields.push("agent_phone");
        }
      }

      if (missingAgentFields.length > 0) {
        console.error("[registerPlayerCore] WhatsApp context warning", {
          assignedAgentId,
          assignedAgentUserId,
          missingAgentFields,
        });
      }
      if (!String(normalizedPlayerPhone ?? "").trim()) {
        throw new Error("Player phone is missing after normalization.");
      }

      await sendWhatsAppCredentials(
        normalizedPlayerPhone,
        username,
        password,
        resolvedGoSportId || "—",
      );
    } catch (e) {
      console.error("[registerPlayerCore] WhatsApp welcome send failed", {
        assignedAgentId,
        assignedAgentUserId,
        username,
        phone: normalizedPlayerPhone,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      await Promise.allSettled([
        createNotification({
          userId: assignedAgentUserId,
          title: "لاعب جديد مربوط",
          message: `قام اللاعب ${result.user.username} بإنشاء حساب جديد واختيارك كوكيل.`,
          link: "/agent/my-players",
        }),
        createNotification({
          userId: result.user.id,
          title: "تم إنشاء الحساب بنجاح",
          message: "تم إنشاء حسابك وربطه بالوكيل بنجاح. يمكنك البدء مباشرة.",
          link: "/player/dashboard",
        }),
      ]);
    } catch (e) {
      console.error("[Notification Service Error] registerPlayerCore notification emit failed", {
        assignedAgentId,
        assignedAgentUserId,
        playerUserId: result.user.id,
        username,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const role = String(result.user.role ?? "PLAYER");

    return {
      ok: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        role,
        status: result.user.status,
        assigned_agent_id: result.user.assignedAgentId,
      },
      nextStep,
    };
  } catch (e) {
    console.error("registerPlayerCore", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        status: 400,
        message: "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.",
      };
    }
    const msg = e instanceof Error ? e.message : "خطأ في السيرفر";
    return { ok: false, status: 500, message: msg };
  }
}
