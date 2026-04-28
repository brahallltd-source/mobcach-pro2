export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PROOF_UPLOADED: "proof_uploaded",
  FLAGGED_FOR_REVIEW: "flagged_for_review",
  AGENT_APPROVED: "agent_approved_waiting_player",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  LINKED_WAITING_FIRST_ORDER: "linked_waiting_first_order",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ORDER_STATUS_VALUES: OrderStatus[] = Object.values(ORDER_STATUS);

export const RECHARGE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type RechargeStatus = (typeof RECHARGE_STATUS)[keyof typeof RECHARGE_STATUS];
export const RECHARGE_STATUS_VALUES: RechargeStatus[] = Object.values(RECHARGE_STATUS);

export const DISPUTE_STATUS = {
  PENDING: "pending",
  RESOLVED: "resolved",
  REJECTED: "rejected",
} as const;

export type DisputeStatus = (typeof DISPUTE_STATUS)[keyof typeof DISPUTE_STATUS];
export const DISPUTE_STATUS_VALUES: DisputeStatus[] = Object.values(DISPUTE_STATUS);

export const AGENT_CUSTOMER_STATUS = {
  REQUESTED: "REQUESTED",
  PENDING: "PENDING",
  CONNECTED: "CONNECTED",
  APPROVED: "APPROVED",
} as const;

export type AgentCustomerStatus =
  (typeof AGENT_CUSTOMER_STATUS)[keyof typeof AGENT_CUSTOMER_STATUS];
export const AGENT_CUSTOMER_STATUS_VALUES: AgentCustomerStatus[] = Object.values(
  AGENT_CUSTOMER_STATUS
);
