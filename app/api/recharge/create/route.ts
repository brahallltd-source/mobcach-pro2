/**
 * Legacy/alternate URL for agent wallet recharge creation.
 * Delegates to {@link POST} in `app/api/agent/recharge/route.ts` (same body and auth).
 */
export { POST } from "@/app/api/agent/recharge/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
