import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { normalize } from "@/lib/json";
import { requireAdmin, requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getOrCreateSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  status: true,
  frozen: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
  wallet: { select: { balance: true } },
} as const;

const VALID_STATUS = new Set(["ACTIVE", "INACTIVE", "BANNED"]);
const VALID_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "AGENT", "PLAYER"]);

function parseWalletFinalBalance(
  raw: unknown,
  allowNegative: boolean
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { ok: false, message: "Missing balance value" };
  }
  const parsed = parseFloat(String(raw).trim());
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: "Invalid balance: must be a finite number" };
  }
  if (parsed < 0 && !allowNegative) {
    return {
      ok: false,
      message: "Balance cannot be negative unless allowNegativeBalance is true",
    };
  }
  return { ok: true, value: parsed };
}

/** Final wallet value from admin UI (`newTotal`) or legacy `newBalance` / `balance`. */
function pickBalanceTargetFromRecord(d: Record<string, unknown>): unknown {
  if (d.newTotal !== undefined && d.newTotal !== null && String(d.newTotal).trim() !== "") {
    return d.newTotal;
  }
  if (d.newBalance !== undefined && d.newBalance !== null && String(d.newBalance).trim() !== "") {
    return d.newBalance;
  }
  if (d.balance !== undefined && d.balance !== null && String(d.balance).trim() !== "") {
    return d.balance;
  }
  return undefined;
}

type ManualAdjustParsed = {
  baseAmount: number;
  operation: "ADD" | "SUB";
  bonusApplied: boolean;
};

function parseManualAdjust(raw: unknown): { ok: true; value: ManualAdjustParsed } | { ok: false; message: string } {
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return { ok: false, message: "manualAdjust object is required when changing wallet balance" };
  }
  const o = raw as Record<string, unknown>;
  const base = parseFloat(String(o.baseAmount ?? ""));
  if (!Number.isFinite(base) || base < 0) {
    return { ok: false, message: "manualAdjust.baseAmount must be a non-negative number" };
  }
  const op = String(o.operation ?? "").trim().toUpperCase();
  if (op !== "ADD" && op !== "SUB") {
    return { ok: false, message: "manualAdjust.operation must be ADD or SUB" };
  }
  const bonusApplied =
    (op === "ADD" && (o.bonusApplied === true || String(o.bonusApplied) === "true")) || false;
  return {
    ok: true,
    value: {
      baseAmount: base,
      operation: op as "ADD" | "SUB",
      bonusApplied,
    },
  };
}

function expectedNewBalanceFromManual(
  previous: number,
  ma: ManualAdjustParsed,
  bonusPercentage: number
): number {
  if (ma.operation === "SUB") {
    return previous - ma.baseAmount;
  }
  const pct =
    Number.isFinite(bonusPercentage) && bonusPercentage >= 0 && bonusPercentage <= 1000
      ? bonusPercentage
      : 10;
  const bonus = ma.bonusApplied ? ma.baseAmount * (pct / 100) : 0;
  return previous + ma.baseAmount + bonus;
}

export async function PATCH(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  const base = await requireAdmin();
  if (!base.ok) {
    return respondIfAdminAccessDenied(base, { success: false });
  }
  const adminUserId = base.user.id;

  let body: {
    userId?: unknown;
    status?: unknown;
    data?: unknown;
    balance?: unknown;
    newBalance?: unknown;
    newTotal?: unknown;
    allowNegativeBalance?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
  }

  let needsManageUsers = false;
  let needsManualBalance = false;

  if (body.status !== undefined && body.status !== null && String(body.status).trim() !== "") {
    needsManageUsers = true;
  }

  if (body.data !== undefined && body.data !== null && typeof body.data === "object") {
    const d = body.data as Record<string, unknown>;
    if (typeof d.email === "string" || typeof d.username === "string" || typeof d.role === "string") {
      needsManageUsers = true;
    }
    const balanceTarget = pickBalanceTargetFromRecord(d);
    if (balanceTarget !== undefined || d.manualAdjust !== undefined) {
      needsManualBalance = true;
    }
  }

  const bodyBalancePick = pickBalanceTargetFromRecord(body as Record<string, unknown>);
  if (bodyBalancePick !== undefined) {
    needsManualBalance = true;
  }

  if (needsManualBalance) {
    const m = await requirePermission("MANUAL_BALANCE_EDIT");
    if (!m.ok) {
      return respondIfAdminAccessDenied(m, { success: false });
    }
  }
  if (needsManageUsers) {
    const m = await requirePermission("MANAGE_USERS");
    if (!m.ok) {
      return respondIfAdminAccessDenied(m, { success: false });
    }
  }
  if (!needsManualBalance && !needsManageUsers) {
    const m = await requirePermission("MANAGE_USERS");
    if (!m.ok) {
      return respondIfAdminAccessDenied(m, { success: false });
    }
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, email: true, username: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const updateData: Prisma.UserUpdateInput = {};
  let balanceAudit: (ManualAdjustParsed & { newBalance: number }) | null = null;

  if (body.status !== undefined && body.status !== null && String(body.status).trim() !== "") {
    const raw = String(body.status).trim().toUpperCase();
    let nextStatus: string;
    if (raw === "TOGGLE") {
      const cur = String(existing.status ?? "ACTIVE").trim().toUpperCase();
      nextStatus = cur === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    } else if (VALID_STATUS.has(raw)) {
      nextStatus = raw;
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid status. Use ACTIVE, INACTIVE, BANNED, or TOGGLE." },
        { status: 400 }
      );
    }
    if (userId === adminUserId && nextStatus !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "You cannot deactivate or ban your own admin account." },
        { status: 400 }
      );
    }
    updateData.status = nextStatus;
  }

  if (body.data !== undefined && body.data !== null && typeof body.data === "object") {
    const d = body.data as Record<string, unknown>;
    if (typeof d.email === "string") {
      const email = normalize(String(d.email));
      if (!email) {
        return NextResponse.json({ success: false, message: "Email cannot be empty" }, { status: 400 });
      }
      const clash = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json({ success: false, message: "Email already in use" }, { status: 400 });
      }
      updateData.email = email;
    }
    if (typeof d.username === "string") {
      const username = String(d.username).trim();
      if (!username) {
        return NextResponse.json({ success: false, message: "Username cannot be empty" }, { status: 400 });
      }
      const clash = await prisma.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json({ success: false, message: "Username already in use" }, { status: 400 });
      }
      updateData.username = username;
    }
    if (typeof d.role === "string") {
      const role = String(d.role).trim().toUpperCase();
      if (!VALID_ROLES.has(role)) {
        return NextResponse.json(
          { success: false, message: "Invalid role. Use ADMIN, SUPER_ADMIN, AGENT, or PLAYER." },
          { status: 400 }
        );
      }
      if (userId === adminUserId && role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { success: false, message: "You cannot remove admin role from your own account." },
          { status: 400 }
        );
      }
      updateData.role = role;
    }
    const allowNeg =
      d.allowNegativeBalance === true ||
      String(d.allowNegativeBalance) === "true";

    const balanceTarget = pickBalanceTargetFromRecord(d);

    if (balanceTarget !== undefined) {
      const ma = parseManualAdjust(d.manualAdjust);
      if (ma.ok === false) {
        return NextResponse.json({ success: false, message: ma.message }, { status: 400 });
      }
      const parsed = parseWalletFinalBalance(balanceTarget, allowNeg);
      if (parsed.ok === false) {
        return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
      }
      updateData.wallet = {
        upsert: {
          create: { balance: parsed.value },
          update: { balance: parsed.value },
        },
      };
      balanceAudit = {
        ...ma.value,
        newBalance: parsed.value,
      };
    }
  }

  const allowNegTop =
    body.allowNegativeBalance === true || String(body.allowNegativeBalance) === "true";

  if (bodyBalancePick !== undefined && !balanceAudit) {
    const parsed = parseWalletFinalBalance(bodyBalancePick, allowNegTop);
    if (parsed.ok === false) {
      return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
    }
    updateData.wallet = {
      upsert: {
        create: { balance: parsed.value },
        update: { balance: parsed.value },
      },
    };
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, message: "Provide status and/or data to update" },
      { status: 400 }
    );
  }

  let previousBalanceForLog = 0;
  if (balanceAudit) {
    const walletRow = await prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });
    previousBalanceForLog = walletRow != null ? Number(walletRow.balance) : 0;
    const sys = await getOrCreateSystemSettings(prisma);
    const bonusPct = Number(sys.bonusPercentage);
    const expected = expectedNewBalanceFromManual(previousBalanceForLog, balanceAudit, bonusPct);
    const tol = Math.max(0.05, Math.abs(previousBalanceForLog) * 1e-9 + 1e-9);
    if (Math.abs(expected - balanceAudit.newBalance) > tol) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Wallet adjustment does not match manualAdjust (check amount, operation, and configured bonus %).",
        },
        { status: 400 }
      );
    }
  }

  try {
    if (balanceAudit) {
      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: updateData,
          select: USER_PUBLIC_SELECT,
        });
        await tx.balanceLog.create({
          data: {
            adminId: adminUserId,
            agentId: userId,
            type: "MANUAL_ADJUST",
            amount: balanceAudit.baseAmount,
            operation: balanceAudit.operation,
            bonusApplied: balanceAudit.bonusApplied,
            previousBalance: previousBalanceForLog,
            newBalance: balanceAudit.newBalance,
          },
        });
        return u;
      });

      return NextResponse.json({ success: true, user });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: USER_PUBLIC_SELECT,
    });
    return NextResponse.json({ success: true, user });
  } catch (e) {
    console.error("PATCH /api/admin/users/update:", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ success: false, message: "Unique constraint violation" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Update failed" }, { status: 500 });
  }
}
