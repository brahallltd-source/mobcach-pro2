/** One row from `GET /api/admin/recharge-requests` (Prisma `RechargeRequest` + safe `User` / `PaymentMethod` picks). */
export type RechargeRequestRow = {
  id: string;
  agentId?: string;
  agentEmail: string;
  amount: number;
  bonusAmount?: number;
  bonus10Percent: number;
  /** Standard recharge bonus DH (alias of computed 10% / stored bonus). */
  bonus_10?: number;
  /** Invitation milestone DH (`pendingBonusApplied`). */
  invitationAffiliateDh?: number;
  /** Same as `invitationAffiliateDh` — explicit name for admin UI. */
  promo_bonus_used?: number;
  /** True when `promo_bonus_used` matches whole invitation blocks (server). */
  promo_bonus_system_verified?: boolean;
  totalWithBonusApprox: number;
  methodDisplayName: string;
  paymentMethod?: {
    id: string;
    methodName: string;
    type: string;
    currency: string;
    accountName: string | null;
    rib: string | null;
  } | null;
  proofUrl: string | null;
  note: string | null;
  status: string;
  flags?: string[];
  createdAt: string;
  updatedAt?: string;
  gosport365Username?: string | null;
  agent: {
    username: string;
    email: string;
  } | null;
};
