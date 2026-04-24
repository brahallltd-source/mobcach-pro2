import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Short URL for agent signup with invite ref — forwards to `/register/agent`. */
export default async function AgentRegisterShortLinkPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.ref;
  const ref = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  redirect(ref ? `/register/agent?ref=${encodeURIComponent(ref)}` : "/register/agent");
}
