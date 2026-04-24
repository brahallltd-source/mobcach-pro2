import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasAuthCookiePresence } from "@/lib/auth-cookie-presence";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const dynamic = "force-dynamic";

/**
 * Mirrors `app/agent/layout.tsx`: DB session + pending gate so `/pending` stays the only
 * in-app surface while `applicationStatus === PENDING` (including users still `PLAYER` in DB).
 */
export default async function PlayerLayout({
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
  const app = String(user.applicationStatus ?? "")
    .trim()
    .toUpperCase();
  if (app === "PENDING") {
    redirect("/pending");
  }
  const role = String(user.role).trim().toUpperCase();
  if (role === "PLAYER") {
    return <>{children}</>;
  }
  if (role === "AGENT") {
    redirect("/agent/dashboard");
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }
  redirect("/login");
}
