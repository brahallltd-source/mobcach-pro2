import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAuthCookiePresence } from "@/lib/auth-cookie-presence";
import { PlayerWaitingRoomGate } from "@/components/player/PlayerWaitingRoomGate";
import { getPrisma } from "@/lib/db";
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
  const headerStore = await headers();
  const cookieStore = await cookies();
  const prisma = getPrisma();
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
    if (!prisma) {
      return <>{children}</>;
    }

    const currentPath =
      headerStore.get("next-url") ||
      headerStore.get("x-invoke-path") ||
      headerStore.get("x-matched-path") ||
      "";
    const onSelectAgentPage = currentPath.includes("/player/select-agent");

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
        updatedAt: true,
      },
    });

    const assignedAgentId =
      String(player?.assignedAgentId ?? user.player?.assignedAgentId ?? "").trim() || null;
    if (!assignedAgentId) {
      if (onSelectAgentPage) {
        return <>{children}</>;
      }
      redirect("/player/select-agent");
    }

    const latestLinkRequest = player
      ? await prisma.agentCustomer.findFirst({
          where: {
            playerId: player.id,
            agentId: assignedAgentId,
          },
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            createdAt: true,
            agent: { select: { fullName: true } },
          },
        })
      : null;

    const latestActivation = await prisma.activation.findFirst({
      where: {
        playerUserId: user.id,
        agentId: assignedAgentId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        createdAt: true,
      },
    });

    const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const userStatus = normalize(user.status);
    const playerStatus = normalize(player?.status);
    const linkStatus = normalize(latestLinkRequest?.status);
    const activationStatus = normalize(latestActivation?.status);
    const pendingStates = new Set([
      "pending",
      "requested",
      "connected",
      "pending_agent",
      "pending_approval",
      "pending_activation",
    ]);
    const isActive =
      userStatus === "active" ||
      playerStatus === "active" ||
      activationStatus === "active";
    const isPending =
      !isActive &&
      (pendingStates.has(userStatus) ||
        pendingStates.has(playerStatus) ||
        pendingStates.has(linkStatus) ||
        pendingStates.has(activationStatus));

    if (isPending) {
      const linkCreatedAt =
        latestLinkRequest?.createdAt ??
        latestActivation?.createdAt ??
        player?.updatedAt ??
        new Date();
      const deadline = new Date(linkCreatedAt.getTime() + 24 * 60 * 60 * 1000);
      return (
        <PlayerWaitingRoomGate
          deadlineIso={deadline.toISOString()}
          agentName={latestLinkRequest?.agent?.fullName ?? null}
        />
      );
    }

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
