import type { PaymentMethodType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied, type AccessResult } from "@/lib/server-auth";
import {
  adminPaymentMethodSchema,
  treasuryAccountNameForPrisma,
} from "@/lib/validations/payment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** `ownerRole: "ADMIN"` rows are global treasury methods — `create` omits `agent` / `agentId` (optional FK defaults unset). */
const ADMIN_TREASURY_OWNER_ROLE = "ADMIN" as const;

async function requireManageSettings(): Promise<AccessResult> {
  return requirePermission("MANAGE_SETTINGS");
}

function parseType(raw: unknown): PaymentMethodType | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "bank" || t === "cash" || t === "crypto") return t as PaymentMethodType;
  return null;
}

/** Maps API field names to Prisma `PaymentMethod` columns (model uses `methodName`, `rib` / `walletAddress`, `active`). */
function treasuryPaymentMethodCreateData(
  input: {
    name: string;
    type: PaymentMethodType;
    accountName: string;
    accountNumber: string;
    isActive: boolean;
  },
  ctx: { ownerUserId: string; currency: string }
): Omit<Prisma.PaymentMethodUncheckedCreateInput, "agentId" | "agent"> {
  const { name, type, accountName, accountNumber, isActive } = input;
  return {
    ownerRole: ADMIN_TREASURY_OWNER_ROLE,
    ownerId: ctx.ownerUserId,
    type,
    methodName: name,
    currency: ctx.currency,
    accountName,
    rib: type === "crypto" ? null : accountNumber || null,
    walletAddress: type === "crypto" ? accountNumber || null : null,
    feePercent: 0,
    active: isActive,
  };
}

/**
 * Normalizes `isActive` / `active` from JSON: booleans, numbers, or strings like `"true"` / `"false"`.
 * Uses `whenBothMissing` when both inputs are `undefined` / `null` / `""`.
 */
function coerceBodyBoolean(
  primary: unknown,
  secondary: unknown,
  whenBothMissing: boolean
): boolean {
  const pick =
    primary !== undefined && primary !== null && String(primary).trim() !== ""
      ? primary
      : secondary !== undefined && secondary !== null && String(secondary).trim() !== ""
        ? secondary
        : undefined;
  if (pick === undefined) return whenBothMissing;
  if (typeof pick === "boolean") return pick;
  if (typeof pick === "number") return pick !== 0;
  const s = String(pick).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return Boolean(pick);
}

function extractMissingFieldName(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as Record<string, unknown> | undefined;
    const fieldName = meta?.field_name;
    if (typeof fieldName === "string" && fieldName.length > 0) return fieldName;
    const target = meta?.target;
    if (Array.isArray(target) && target.length > 0) return String(target[0]);
    if (typeof target === "string" && target.length > 0) return target;
    if (error.code) return String(error.code);
  }
  const msg = error instanceof Error ? error.message : String(error);
  const unknownArg = msg.match(/Unknown argument `([^`]+)`/);
  if (unknownArg) return unknownArg[1];
  const missingArg = msg.match(/Argument `([^`]+)` is missing/);
  if (missingArg) return missingArg[1];
  const invalidArg = msg.match(/Invalid value for argument `([^`]+)`/);
  if (invalidArg) return invalidArg[1];
  return "unknown";
}

/** Map Prisma client errors to a 400 JSON body with a clear `error` + full `details`. */
function prismaClientErrorResponse(error: unknown): NextResponse | null {
  const details = error instanceof Error ? error.message : String(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const missingFieldName = extractMissingFieldName(error);
    return NextResponse.json(
      { error: "Missing field: " + missingFieldName, details },
      { status: 400 }
    );
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    const missingFieldName = extractMissingFieldName(error);
    return NextResponse.json(
      { error: "Missing field: " + missingFieldName, details },
      { status: 400 }
    );
  }
  return null;
}

function mapMethod(m: {
  id: string;
  type: string;
  methodName: string;
  currency: string;
  accountName: string | null;
  rib: string | null;
  walletAddress: string | null;
  network: string | null;
  provider: string | null;
  phone: string | null;
  instructions: string | null;
  active: boolean;
  feePercent: number;
}) {
  const accountNumber =
    m.type === "crypto" ? (m.walletAddress ?? "") : (m.rib ?? "");
  return {
    ...m,
    name: m.methodName,
    isActive: m.active,
    accountNumber,
    method_name: m.methodName,
    account_name: m.accountName,
    wallet_address: m.walletAddress,
  };
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    const auth = await requireManageSettings();
    if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { methods: [] });
    }

    const methods = await prisma.paymentMethod.findMany({
      where: { ownerRole: ADMIN_TREASURY_OWNER_ROLE },
      orderBy: { createdAt: "desc" },
    });

    const formatted = methods.map((m) => mapMethod(m));

    return NextResponse.json({ methods: formatted });
  } catch {
    return NextResponse.json({ methods: [] });
  }
}

export async function POST(request: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await requireManageSettings();
    if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = adminPaymentMethodSchema.safeParse({
      name: body.name,
      type: body.type,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      isActive: body.isActive ?? body.active,
      currency: body.currency,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: first?.message ?? "Validation error",
          issues: parsed.error.issues,
          receivedBody: body,
        },
        { status: 400 }
      );
    }

    const v = parsed.data;
    const accountNamePrisma = treasuryAccountNameForPrisma(v.accountName);

    const created = await prisma.paymentMethod.create({
      data: treasuryPaymentMethodCreateData(
        {
          name: v.name,
          type: v.type,
          accountName: accountNamePrisma,
          accountNumber: v.accountNumber,
          isActive: v.isActive,
        },
        {
          ownerUserId: auth.user.id,
          currency: v.currency,
        }
      ),
    });

    return NextResponse.json(
      { success: true, data: mapMethod(created) },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("POST /api/admin/payment-methods:", e);
    const prismaRes = prismaClientErrorResponse(e);
    if (prismaRes) return prismaRes;
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await requireManageSettings();
    if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const methodId = String(body.id ?? "").trim();
    if (!methodId) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, ownerRole: ADMIN_TREASURY_OWNER_ROLE },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Method not found" }, { status: 404 });
    }

    const type = parseType(body.type);
    if (!type) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing type (bank, cash, crypto)" },
        { status: 400 }
      );
    }

    const name = String(body.name ?? body.method_name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "name is required" }, { status: 400 });
    }

    const accountName =
      String(body.accountName ?? body.account_name ?? "").trim() || null;
    const accountNumber =
      String(
        body.accountNumber ??
          body.rib ??
          body.wallet_address ??
          ""
      ).trim() || null;
    if (!accountNumber) {
      return NextResponse.json(
        { success: false, message: "رقم الحساب أو عنوان المحفظة مطلوب" },
        { status: 400 }
      );
    }
    if (type === "bank" && (!accountName || !String(accountName).trim())) {
      return NextResponse.json(
        { success: false, message: "اسم صاحب الحساب مطلوب للتحويلات البنكية" },
        { status: 400 }
      );
    }
    const isActive = coerceBodyBoolean(body.isActive, body.active, existing.active);

    const rib = type === "crypto" ? null : accountNumber || null;
    const walletAddress = type === "crypto" ? accountNumber || null : null;

    const updated = await prisma.paymentMethod.update({
      where: { id: methodId },
      data: {
        type,
        methodName: name,
        currency: String(body.currency ?? "MAD").trim(),
        accountName,
        rib,
        walletAddress,
        network: String(body.network ?? "").trim() || null,
        phone: String(body.phone ?? "").trim() || null,
        feePercent: Number(body.fee_percent ?? 0),
        active: isActive,
        provider: String(body.provider ?? "").trim() || null,
        instructions: String(body.instructions ?? "").trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: mapMethod(updated) });
  } catch (e: unknown) {
    console.error("PUT /api/admin/payment-methods:", e);
    const prismaRes = prismaClientErrorResponse(e);
    if (prismaRes) return prismaRes;
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await requireManageSettings();
    if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const methodId = String(body.methodId ?? body.id ?? "").trim();
    if (!methodId) {
      return NextResponse.json({ success: false, message: "methodId is required" }, { status: 400 });
    }

    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, ownerRole: ADMIN_TREASURY_OWNER_ROLE },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Method not found" }, { status: 404 });
    }

    const hasActiveInput =
      body.active !== undefined && body.active !== null && String(body.active).trim() !== "";
    const hasIsActiveInput =
      body.isActive !== undefined &&
      body.isActive !== null &&
      String(body.isActive).trim() !== "";
    const hasActiveUpdate = hasActiveInput || hasIsActiveInput;

    const detailKeys = [
      "name",
      "method_name",
      "type",
      "accountName",
      "account_name",
      "accountNumber",
      "rib",
      "wallet_address",
      "currency",
      "network",
      "phone",
      "instructions",
      "provider",
      "fee_percent",
    ];
    const hasDetailUpdate = detailKeys.some((k) => body[k] !== undefined && body[k] !== null);

    if (!hasActiveUpdate && !hasDetailUpdate) {
      return NextResponse.json(
        { success: false, message: "Provide active/isActive and/or fields to update (name, type, rib, …)" },
        { status: 400 }
      );
    }

    const data: Prisma.PaymentMethodUpdateInput = {};

    if (hasActiveUpdate) {
      data.active = coerceBodyBoolean(body.active, body.isActive, existing.active);
    }

    if (hasDetailUpdate) {
      const type =
        parseType(body.type ?? existing.type) ?? (existing.type as PaymentMethodType);
      const name = String(body.name ?? body.method_name ?? existing.methodName ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { success: false, message: "methodName (name) is required when updating details" },
          { status: 400 }
        );
      }
      const accountName =
        body.accountName !== undefined || body.account_name !== undefined
          ? String(body.accountName ?? body.account_name ?? "").trim() || null
          : existing.accountName;
      const accountNumberExplicit =
        body.accountNumber !== undefined ||
        body.rib !== undefined ||
        body.wallet_address !== undefined;
      const accountNumber = accountNumberExplicit
        ? String(body.accountNumber ?? body.rib ?? body.wallet_address ?? "").trim() || null
        : type === "crypto"
          ? existing.walletAddress
          : existing.rib;
      const rib = type === "crypto" ? null : accountNumber || null;
      const walletAddress = type === "crypto" ? accountNumber || null : null;

      if (!accountNumber || !String(accountNumber).trim()) {
        return NextResponse.json(
          { success: false, message: "رقم الحساب أو عنوان المحفظة مطلوب" },
          { status: 400 }
        );
      }
      if (type === "bank" && (!accountName || !String(accountName).trim())) {
        return NextResponse.json(
          { success: false, message: "اسم صاحب الحساب مطلوب للتحويلات البنكية" },
          { status: 400 }
        );
      }

      data.type = type;
      data.methodName = name;
      data.accountName = accountName;
      data.rib = rib;
      data.walletAddress = walletAddress;
      if (body.currency !== undefined && body.currency !== null) {
        data.currency = String(body.currency).trim();
      }
      if (body.network !== undefined && body.network !== null) {
        data.network = String(body.network).trim() || null;
      }
      if (body.phone !== undefined && body.phone !== null) {
        data.phone = String(body.phone).trim() || null;
      }
      if (body.instructions !== undefined && body.instructions !== null) {
        data.instructions = String(body.instructions).trim() || null;
      }
      if (body.provider !== undefined && body.provider !== null) {
        data.provider = String(body.provider).trim() || null;
      }
      if (body.fee_percent !== undefined && body.fee_percent !== null) {
        const fp = Number(body.fee_percent);
        if (Number.isFinite(fp)) data.feePercent = fp;
      }
    }

    const updated = await prisma.paymentMethod.update({
      where: { id: methodId },
      data,
    });

    return NextResponse.json({ success: true, data: mapMethod(updated) });
  } catch (e: unknown) {
    console.error("PATCH /api/admin/payment-methods:", e);
    const prismaRes = prismaClientErrorResponse(e);
    if (prismaRes) return prismaRes;
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await requireManageSettings();
    if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { success: false });
    }

    const methodId = String(new URL(request.url).searchParams.get("methodId") ?? "").trim();
    if (!methodId) {
      return NextResponse.json({ success: false, message: "methodId is required" }, { status: 400 });
    }

    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, ownerRole: ADMIN_TREASURY_OWNER_ROLE },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Method not found" }, { status: 404 });
    }

    await prisma.paymentMethod.delete({ where: { id: methodId } });
    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (e: unknown) {
    console.error("DELETE /api/admin/payment-methods:", e);
    const prismaRes = prismaClientErrorResponse(e);
    if (prismaRes) return prismaRes;
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
