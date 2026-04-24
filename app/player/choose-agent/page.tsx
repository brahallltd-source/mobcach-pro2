"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingCard, SidebarShell } from "@/components/ui";

/** Canonical marketplace: {@link import("../select-agent/page")}. */
export default function PlayerChooseAgentRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/player/select-agent");
  }, [router]);
  return (
    <SidebarShell role="player">
      <LoadingCard text="جاري التوجيه..." />
    </SidebarShell>
  );
}
