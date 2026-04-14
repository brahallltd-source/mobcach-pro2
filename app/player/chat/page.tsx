"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, Send, CheckCircle, User, Info } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
} from "@/components/ui";

type ChatMessage = {
  id: string;
  senderRole: string;
  message: string;
  created_at: string;
};

type Conversation = {
  agentId: string;
};

// 1. فصلنا محتوى الشات في دالة خاصة باش نقدرو نغلفوها بـ Suspense
function ChatContent() {
  const searchParams = useSearchParams();
  const targetAgentId = searchParams.get("agentId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(targetAgentId);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [playerEmail, setPlayerEmail] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async (email: string) => {
    try {
      const res = await fetch(`/api/order-messages?listRole=player&userEmail=${encodeURIComponent(email)}`);
      const data = await res.json();
      
      const uniqueAgents = new Map();
      (data.conversations || []).forEach((order: any) => {
        if (order.agentId && !uniqueAgents.has(order.agentId)) {
          uniqueAgents.set(order.agentId, { agentId: order.agentId });
        }
      });
      setConversations(Array.from(uniqueAgents.values()));
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const loadMessages = async (email: string, agentId: string) => {
    try {
      const res = await fetch(`/api/order-messages?playerEmail=${encodeURIComponent(email)}&agentId=${agentId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    setPlayerEmail(user.email);

    loadConversations(user.email).finally(() => setLoading(false));

    if (activeAgent) {
      loadMessages(user.email, activeAgent);
    }

    const timer = setInterval(() => {
      if (activeAgent) loadMessages(user.email, activeAgent);
    }, 4000);

    return () => clearInterval(timer);
  }, [activeAgent]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeAgent || !playerEmail) return;

    const messageText = newMessage;
    setNewMessage(""); 

    try {
      await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderRole: "player",
          playerEmail: playerEmail,
          agentId: activeAgent,
          message: messageText,
        }),
      });
      loadMessages(playerEmail, activeAgent);
    } catch (error) {
      console.error("Send error", error);
      alert("فشل إرسال الرسالة، جرب مرة أخرى.");
    }
  };

  if (loading) {
    return <LoadingCard text="جاري تحميل المحادثات..." />;
  }

  return (
    <>
      <PageHeader
        title="الدردشة المباشرة (Live Chat)"
        subtitle="تواصل مع وكلائك المعتمدين، ارسل وصولات الدفع، وتابع تحديثات طلباتك في مكان واحد."
      />

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px]">
        
        {/* Sidebar */}
        <GlassCard className="flex flex-col overflow-hidden border-white/10">
          <div className="p-4 border-b border-white/10 bg-white/5 font-bold flex items-center gap-2 text-cyan-400">
            <MessageCircle size={18} /> وكلاء تعاملت معهم
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {conversations.length > 0 ? (
              conversations.map((c) => (
                <div
                  key={c.agentId}
                  onClick={() => setActiveAgent(c.agentId)}
                  className={`p-3 rounded-2xl cursor-pointer transition flex items-center gap-3 ${
                    activeAgent === c.agentId
                      ? "bg-cyan-500/20 border border-cyan-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeAgent === c.agentId ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-white/50'}`}>
                    <User size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">الوكيل المعتمد</p>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">ID: {c.agentId.split('-')[0]}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-white/30 text-xs mt-10 italic">
                لا توجد محادثات سابقة.
              </div>
            )}
          </div>
        </GlassCard>

        {/* Main Chat Area */}
        <GlassCard className="flex flex-col overflow-hidden relative border-white/10">
          {activeAgent ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length > 0 ? (
                  messages.map((m) => {
                    const isSystem = m.senderRole === "system";
                    const isMe = m.senderRole === "player";

                    if (isSystem) {
                      return (
                        <div key={m.id} className="flex justify-center my-4">
                          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-5 py-2.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            {m.message.includes("✅") || m.message.includes("🏁") ? <CheckCircle size={14} /> : <Info size={14} />}
                            <span className="font-semibold tracking-wide">{m.message}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-lg ${
                            isMe
                              ? "bg-cyan-600 text-white rounded-tr-sm"
                              : "bg-white/10 text-white/90 rounded-tl-sm border border-white/5"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                          <p className={`text-[10px] mt-2 font-mono ${isMe ? 'text-cyan-200/70 text-right' : 'text-white/40 text-left'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 italic">
                    <MessageCircle size={48} className="mb-3 opacity-20" />
                    <p>أرسل وصل الدفع أو استفسارك هنا...</p>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              <div className="p-4 border-t border-white/10 bg-black/40 flex items-end gap-3">
                <TextArea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  className="min-h-[55px] max-h-[120px] py-3.5 bg-white/5 border-white/10 focus:border-cyan-500/50 resize-none rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <PrimaryButton 
                  onClick={handleSend} 
                  disabled={!newMessage.trim()}
                  className="h-[55px] px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center"
                >
                  <Send size={20} className={newMessage.trim() ? "translate-x-0.5 transition-transform" : ""} />
                </PrimaryButton>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/20">
              <MessageCircle size={72} className="mb-6 opacity-10" />
              <p className="text-lg font-semibold tracking-wide">اختر محادثة للبدء</p>
              <p className="text-sm mt-2">حدد وكيلاً من القائمة الجانبية لعرض الرسائل</p>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

// 2. الصفحة الرئيسية تقوم فقط بتغليف المحتوى بـ Suspense
export default function PlayerChatPage() {
  return (
    <SidebarShell role="player">
      <Suspense fallback={<LoadingCard text="جاري تحضير المحادثات..." />}>
        <ChatContent />
      </Suspense>
    </SidebarShell>
  );
}