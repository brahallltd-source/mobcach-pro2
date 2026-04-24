import { redirect } from "next/navigation";

/** Legacy URL: public registration now lives at `/register/agent`. */
export default async function ApplyAgentRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const refRaw = p.ref;
  const ref = typeof refRaw === "string" ? refRaw : Array.isArray(refRaw) ? refRaw[0] : undefined;
  redirect(ref ? `/register/agent?ref=${encodeURIComponent(ref)}` : "/register/agent");
}
