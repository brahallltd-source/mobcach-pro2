/**
 * Compatibility: some clients call `/api/agents/active` — same behavior as discovery listing.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export { GET } from "../discovery/route";
