import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentSessionHeartbeat } from "@/components/AgentSessionHeartbeat";
import { hasAuthCookiePresence } from "@/lib/auth-cookie-presence";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const dynamic = "force-dynamic";

/**
 * Uses the same DB-backed session resolution as `GET /api/auth/session` (not JWT `role` claim alone
 * and not `localStorage`), so cookie-only logins are recognized.
 * `middleware.ts` also sends `PENDING` users to `/pending` first — this is a second line of defense.
 */
export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const user = await getSessionUserFromCookies();
  if (!user) {
    const get = (name: string) => cookieStore.get(name)?.value;
    if (hasAuthCookiePresence(get)) {
      return <>{children}</>;
    }
    redirect("/login");
  }
  const role = String(user.role).trim().toUpperCase();
  if (role === "AGENT") {
    const app = String(user.applicationStatus ?? "")
      .trim()
      .toUpperCase();
    if (app === "PENDING") {
      redirect("/pending");
    }
    return (
      <>
        <AgentSessionHeartbeat />
        {children}
      </>
    );
  }
  if (role === "PLAYER") {
    redirect("/player/dashboard");
  }
  if (role === "ADMIN") {
    redirect("/admin/dashboard");
  }
  redirect("/login");
}
