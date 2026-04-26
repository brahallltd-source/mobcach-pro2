import { z } from "zod";

function isHttpProofUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const baseFields = {
  amount: z.string().min(1, "Amount required"),
  admin_method_id: z.string().min(1, "Payment method required"),
  proof_url: z.string(),
  transaction_hash: z.string(),
  gosport365_username: z.string(),
  confirm_gosport365_username: z.string(),
};

/**
 * Client-side validation for agent → admin wallet recharge (`RechargeForm` → `POST /api/agent/recharge`).
 * When `isCrypto` is true, receipt image URL is optional; otherwise a valid `http(s)` proof URL is required.
 */
export function parseAgentRechargeForm(
  raw: {
    amount: string;
    admin_method_id: string;
    proof_url: string;
    transaction_hash: string;
    gosport365_username: string;
    confirm_gosport365_username: string;
  },
  opts: { isCrypto: boolean; minAmount: number; amountTooLowMessage?: string },
) {
  const schema = z
    .object(baseFields)
    .superRefine((data, ctx) => {
      const amountNum = parseFloat(String(data.amount).trim());
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Invalid amount" });
      } else if (amountNum < opts.minAmount) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message:
            opts.amountTooLowMessage ??
            `Minimum recharge is ${opts.minAmount} DH`,
        });
      }

      const g = String(data.gosport365_username ?? "").trim();
      const c = String(data.confirm_gosport365_username ?? "").trim();
      if (!g) {
        ctx.addIssue({ code: "custom", path: ["gosport365_username"], message: "GoSport365 username required" });
      } else if (g !== c) {
        ctx.addIssue({
          code: "custom",
          path: ["confirm_gosport365_username"],
          message: "Usernames must match",
        });
      }

      const proof = String(data.proof_url ?? "").trim();
      const tx = String(data.transaction_hash ?? "").trim();

      if (!opts.isCrypto) {
        if (!isHttpProofUrl(proof)) {
          ctx.addIssue({
            code: "custom",
            path: ["proof_url"],
            message: "Valid payment proof URL (image) is required",
          });
        }
      } else {
        if (proof && !isHttpProofUrl(proof)) {
          ctx.addIssue({
            code: "custom",
            path: ["proof_url"],
            message: "Invalid proof URL",
          });
        }
        if (tx.length > 512) {
          ctx.addIssue({
            code: "custom",
            path: ["transaction_hash"],
            message: "Transaction hash is too long",
          });
        }
      }
    });

  return schema.safeParse(raw);
}
