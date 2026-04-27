/**
 * Compatibility entry: product docs refer to `POST /api/recharge/request`.
 * Implementation lives in `app/api/agent/recharge/route.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { POST } from "../../agent/recharge/route";
