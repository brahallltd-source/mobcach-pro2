import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { assertAdultDateString, registerPlayerApiSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/security";

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
    dateOfBirth,
    username,
    inviteCode: inviteParsed,
    agent_code: agentParsed,
    selectedAgentId: selectedAgentParsed,
  } = parsed.data;

  if (!assertAdultDateString(dateOfBirth, 18)) {
    return {
      ok: false,
      status: 400,
      message: "عذراً، يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل",
    };
  }

  const inviteCodeRaw = String(inviteParsed ?? "").trim();
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    return {
      ok: false,
      status: 400,
      message: "البريد الإلكتروني أو اسم المستخدم موجود مسبقاً",
    };
  }

  const passwordHash = await hashPassword(password);

  let assignedAgentId: string | null = null;
  let playerStatus: string = "inactive";
  let accountUserStatus = "ACTIVE";
  let nextStep = "/player/choose-agent";
  /** When creating `AgentCustomer` in the same transaction. */
  let agentCustomerLinkStatus: "REQUESTED" | "CONNECTED" | "PENDING" | null = null;

  const linkableAgentStatuses = ["ACTIVE", "active", "account_created", "pending"];

  /** `?ref=` / `inviteCode` is the agent’s `User.inviteCode` — not the player’s username. */
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
    accountUserStatus = "PENDING_APPROVAL";
    playerStatus = "inactive";
    agentCustomerLinkStatus = "REQUESTED";
    nextStep = "/player/dashboard";
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
      accountUserStatus = "PENDING_APPROVAL";
      playerStatus = "inactive";
      agentCustomerLinkStatus = "PENDING";
      nextStep = "/login";
    } else {
      const agentInput = String(agentParsed ?? "").trim();

      if (agentInput !== "") {
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
          accountUserStatus = "ACTIVE";
          playerStatus = "active";
          agentCustomerLinkStatus = "CONNECTED";
          nextStep = "/player/choose-agent";
        } else {
          return {
            ok: false,
            status: 400,
            message: "كود الوكيل غير صحيح أو الوكيل غير موجود",
          };
        }
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dobDate = new Date(dateOfBirth);
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: "PLAYER",
          applicationStatus: "NONE",
          status: accountUserStatus,
          playerStatus: playerStatus as never,
          assignedAgentId,
          country,
          city,
          dateOfBirth: dobDate,
        },
      });

      const player = await tx.player.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          username,
          phone: normalizePhoneWithCountry(phone, country),
          status: playerStatus as never,
          assignedAgentId,
          country,
          city,
          dateOfBirth: dateOfBirth.slice(0, 10),
        },
      });

      if (assignedAgentId && agentCustomerLinkStatus) {
        await tx.agentCustomer.create({
          data: {
            agentId: assignedAgentId,
            playerId: player.id,
            status: agentCustomerLinkStatus,
          },
        });
      }

      return { user };
    });

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
