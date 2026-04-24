import { ADMIN_BANK_METHOD_OPTIONS, ADMIN_CASH_METHOD_OPTIONS } from "@/lib/constants/payment-methods";

/** @deprecated Prefer `ADMIN_BANK_METHOD_OPTIONS` from `@/lib/constants/payment-methods`. */
export const MOROCCAN_BANKS = [...ADMIN_BANK_METHOD_OPTIONS] as string[];

/** @deprecated Prefer `ADMIN_CASH_METHOD_OPTIONS` from `@/lib/constants/payment-methods`. */
export const CASH_NETWORKS = [...ADMIN_CASH_METHOD_OPTIONS] as string[];

export const CRYPTO_NETWORKS = ["TRC20", "BEP20", "ERC20", "BTC"];
export const EXECUTION_TIME_OPTIONS = [15, 30, 45, 60, 120, 180];
