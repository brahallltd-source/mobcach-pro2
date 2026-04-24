/** Linked player–agent rows ready for GS365 / quick recharge flows. */
export function isAgentCustomerLinkedStatus(status: string): boolean {
  const u = String(status ?? "").trim().toUpperCase();
  return u === "APPROVED" || u === "CONNECTED";
}

/** Rows awaiting agent approval / GS setup. */
export function isAgentCustomerPendingRequestStatus(status: string): boolean {
  const u = String(status ?? "").trim().toUpperCase();
  return u === "REQUESTED" || u === "PENDING";
}
