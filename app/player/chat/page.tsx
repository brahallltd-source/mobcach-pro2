"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/ChatInterface";
import { LoadingCard, PageHeader, SidebarShell } from "@/components/ui";

function ChatContent() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId");
  const [playerEmail, setPlayerEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) {
      window.location.href = "/login";
      return;
    }
    const user = JSON.parse(saved) as { email?: string; role?: string };
    if (String(user.role ?? "").toLowerCase() !== "player") {
      window.location.href = "/login";
      return;
    }
    setPlayerEmail(String(user.email || "").trim().toLowerCase());
  }, []);

  if (!playerEmail) {
    return <LoadingCard text="جاري تحميل المحادثات..." />;
  }

  return (
    <>
      <PageHeader
        title="الرسائل"
        subtitle="تواصل مع وكيلك، تابع آخر الرسائل، وأرسل الاستفسارات أو الوثائق من مكان واحد."
      />
      <ChatInterface
        role="player"
        playerEmail={playerEmail}
        agentId={null}
        initialContactId={initialAgentId}
        listHeading="المحادثات"
        emptyListHint="لا توجد محادثات بعد — تظهر الجهات بعد أول طلب مع وكيل."
        composerPlaceholder="اكتب رسالتك… (Shift+Enter سطر جديد)"
      />
    </>
  );
}

export default function PlayerChatPage() {
  return (
    <SidebarShell role="player">
      <Suspense fallback={<LoadingCard text="جاري تحضير المحادثات..." />}>
        <ChatContent />
      </Suspense>
    </SidebarShell>
  );
}
