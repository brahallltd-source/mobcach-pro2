import type { Prisma } from "@prisma/client";

export type TreasuryBody = Record<string, unknown>;

function normalizeMethod(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isCloudinaryReceiptUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const ok =
      host === "res.cloudinary.com" ||
      host === "cloudinary.com" ||
      host.endsWith(".cloudinary.com");
    return ok ? s : null;
  } catch {
    return null;
  }
}

const RIB_METHODS = new Set([
  "CIH",
  "BANK",
  "BANK_TRANSFER",
  "ATTIJARI",
  "BMCE",
  "BMCI",
  "CFG_BANK",
]);

const PHONE_METHODS = new Set([
  "ORANGE_MONEY",
  "ORANGEMONEY",
  "ORANGE",
  "JIBI",
  "MTCASH",
  "DABAPAY",
  "DABA_PAY",
]);

const SKRILL_METHODS = new Set(["SKRILL"]);
const USDT_METHODS = new Set(["USDT"]);

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type ValidatedTreasury = {
  amount: number;
  method: string;
  details: Prisma.JsonObject;
  receiptUrl: string;
  motif: string;
};

export function validateTreasuryRechargeInput(input: {
  body: TreasuryBody;
  hasUsdtAccess: boolean;
}): { ok: true; value: ValidatedTreasury } | { ok: false; message: string } {
  const { body, hasUsdtAccess } = input;

  const amountRaw = body.amount;
  let amount: number;
  if (typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw > 0) {
    amount = amountRaw;
  } else if (typeof amountRaw === "string" && amountRaw.trim() !== "") {
    const n = parseFloat(amountRaw.trim());
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, message: "Invalid amount" };
    }
    amount = n;
  } else {
    return { ok: false, message: "Invalid amount" };
  }

  const method = normalizeMethod(body.method);
  if (!method) {
    return { ok: false, message: "Missing payment method" };
  }

  const motif = String(body.motif ?? "").trim();
  if (!motif) {
    return { ok: false, message: "motif is required" };
  }

  const receiptUrl = isCloudinaryReceiptUrl(body.receiptUrl ?? body.receipt_url);
  if (!receiptUrl) {
    return {
      ok: false,
      message: "receiptUrl must be a valid http(s) URL hosted on Cloudinary",
    };
  }

  if (USDT_METHODS.has(method)) {
    if (!hasUsdtAccess) {
      return { ok: false, message: "USDT top-up is not enabled for this account" };
    }
    const details =
      body.details != null && typeof body.details === "object" && !Array.isArray(body.details)
        ? (body.details as Record<string, unknown>)
        : {};
    return {
      ok: true,
      value: {
        amount,
        method,
        details: details as Prisma.JsonObject,
        receiptUrl,
        motif,
      },
    };
  }

  const detailsRaw = body.details;
  if (
    detailsRaw == null ||
    typeof detailsRaw !== "object" ||
    Array.isArray(detailsRaw)
  ) {
    return { ok: false, message: "details must be a JSON object" };
  }
  const details = detailsRaw as Record<string, unknown>;

  if (RIB_METHODS.has(method)) {
    const rib = String(details.rib ?? "").replace(/\s+/g, "");
    if (!/^\d{24}$/.test(rib)) {
      return { ok: false, message: "details.rib must be exactly 24 digits" };
    }
    return {
      ok: true,
      value: {
        amount,
        method,
        details: { ...details, rib } as Prisma.JsonObject,
        receiptUrl,
        motif,
      },
    };
  }

  if (PHONE_METHODS.has(method)) {
    const phone = String(details.phone ?? "").replace(/\s+/g, "");
    if (!/^0[67]\d{8}$/.test(phone)) {
      return {
        ok: false,
        message:
          "details.phone must be 10 digits and start with 06 or 07",
      };
    }
    return {
      ok: true,
      value: {
        amount,
        method,
        details: { ...details, phone } as Prisma.JsonObject,
        receiptUrl,
        motif,
      },
    };
  }

  if (SKRILL_METHODS.has(method)) {
    const email = String(details.email ?? "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      return { ok: false, message: "details.email must be a valid email address" };
    }
    return {
      ok: true,
      value: {
        amount,
        method,
        details: { ...details, email } as Prisma.JsonObject,
        receiptUrl,
        motif,
      },
    };
  }

  return {
    ok: false,
    message:
      "Unsupported method for treasury top-up (use CIH/bank, Orange/Jibi/DabaPay, Skrill, or USDT when enabled)",
  };
}
