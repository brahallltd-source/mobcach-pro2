/**
 * Compatibility entry: product docs refer to `POST /api/recharge/request`.
 * Implementation lives in `app/api/agent/recharge/route.ts`.
 */
export { POST, runtime, dynamic } from "../../agent/recharge/route";
