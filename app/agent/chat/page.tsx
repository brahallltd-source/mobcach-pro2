"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/ChatInterface";
import { LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

function AgentChatInner() {
  const searchParams = useSearchParams();
  const initialPlayerEmail = searchParams.get("playerEmail");

  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await requireMobcashUserOnClient("agent");
      if (!user) {
        redirectToLogin();
        return;
      }
      if (cancelled) return;
      const myAgentId = String((user as { agentId?: string }).agentId || user.id);
      setAgentId(myAgentId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !agentId) {
    return <LoadingCard text="جاري تحميل المحادثات..." />;
  }

  return (
    <>
      <PageHeader
        title="صندوق الرسائل"
        subtitle="راسل لاعبيك، راجع آخر النقاشات، وتابع الطلبات من واجهة موحّدة."
      />
      <ChatInterface
        role="agent"
        playerEmail={null}
        agentId={agentId}
        initialContactId={initialPlayerEmail ? initialPlayerEmail.trim() : null}
        listHeading="اللاعبون"
        emptyListHint="لا يوجد لاعبون في القائمة بعد — يظهرون بعد أول طلب."
        composerPlaceholder="اكتب ردك… (Shift+Enter سطر جديد)"
        showContactSearch
      />
    </>
  );
}

export default function AgentChatPage() {
  return (
    <SidebarShell role="agent">
      <Suspense fallback={<LoadingCard text="جاري تحضير المحادثات..." />}>
        <AgentChatInner />
      </Suspense>
    </SidebarShell>
  );
}
