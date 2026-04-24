/**
 * Same behavior as `GET /api/auth/session` — current user from session cookies.
 * Use this as the client “who am I” endpoint; it does not read `localStorage`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET } from "../session/route";
