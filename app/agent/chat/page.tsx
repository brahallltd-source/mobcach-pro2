"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MessageCircle, Send, CheckCircle, User, Info, Search } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";

type ChatMessage = {
  id: string;
  senderRole: string;
  message: string;
  created_at: string;
};

type PlayerConversation = {
  playerEmail: string;
  gosportUsername?: string;
};

export default function AgentChatPage() {
  const [conversations, setConversations] = useState<PlayerConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- 🟢 دالة مسح التنبيهات للوكيل ---
  const markAllAsRead = async () => {
    try {
      const saved = localStorage.getItem("mobcash_user");
      if (!saved) return;
      const user = JSON.parse(saved);
      const role = String(user.role).toLowerCase();
      const targetId = user.agentId || user.id;

      const res = await fetch(`/api/notifications?role=${role}&targetId=${targetId}`);
      const data = await res.json();
      
      // جلب الإشعارات غير المقروءة فقط
      const unreadNotifs = (data.notifications || []).filter((n: any) => !n.read);

      for (const notif of unreadNotifs) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notif.id }),
        });
      }
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };
  // ---------------------------------------

  const loadConversations = async (currentAgentId: string) => {
    try {
      const res = await fetch(`/api/order-messages?listRole=agent&userEmail=${currentAgentId}`);
      const data = await res.json();
      
      const uniquePlayers = new Map();
      (data.conversations || []).forEach((order: any) => {
        if (order.playerEmail && !uniquePlayers.has(order.playerEmail)) {
          uniquePlayers.set(order.playerEmail, { 
            playerEmail: order.playerEmail,
            gosportUsername: order.gosportUsername
          });
        }
      });
      setConversations(Array.from(uniquePlayers.values()));
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const loadMessages = async (currentAgentId: string, playerEmail: string) => {
    try {
      const res = await fetch(`/api/order-messages?playerEmail=${encodeURIComponent(playerEmail)}&agentId=${currentAgentId}`);
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
    const myAgentId = user.agentId;
    setAgentId(myAgentId);

    loadConversations(myAgentId).finally(() => setLoading(false));

    if (activePlayer) {
      loadMessages(myAgentId, activePlayer);
      // ✅ مسح تنبيهات الوكيل عند فتح شات اللاعب
      markAllAsRead();
    }

    const timer = setInterval(() => {
      loadConversations(myAgentId);
      if (activePlayer) {
        loadMessages(myAgentId, activePlayer);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [activePlayer]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activePlayer || !agentId) return;

    const messageText = newMessage;
    setNewMessage(""); 

    try {
      await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderRole: "agent",
          playerEmail: activePlayer,
          agentId: agentId,
          message: messageText,
        }),
      });
      loadMessages(agentId, activePlayer);
    } catch (error) {
      console.error("Send error", error);
    }
  };

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter(c => 
      c.playerEmail.toLowerCase().includes(q) || 
      (c.gosportUsername && c.gosportUsername.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري تحميل المحادثات..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="صندوق رسائل الوكيل (Agent Inbox)"
        subtitle="تواصل مع اللاعبين، راجع وصولات الدفع، وتابع تاريخ عملياتهم في مساحة عمل واحدة مدمجة."
      />

      <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[600px] mt-4">
        
        {/* Sidebar */}
        <GlassCard className="flex flex-col overflow-hidden border-white/10">
          <div className="p-4 border-b border-white/10 bg-white/5 space-y-3">
            <div className="font-bold flex items-center gap-2 text-cyan-400">
              <MessageCircle size={18} /> قائمة العملاء
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <TextField 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالإيميل أو اليوزر..." 
                className="pl-9 py-2 text-sm bg-black/40 border-white/10" 
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => (
                <div
                  key={c.playerEmail}
                  onClick={() => setActivePlayer(c.playerEmail)}
                  className={`p-3 rounded-2xl cursor-pointer transition flex items-center gap-3 ${
                    activePlayer === c.playerEmail
                      ? "bg-cyan-500/20 border border-cyan-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activePlayer === c.playerEmail ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-white/50'}`}>
                    <User size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-white truncate">{c.gosportUsername || 'Unknown User'}</p>
                    <p className="text-[10px] text-white/50 truncate mt-0.5">{c.playerEmail}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-white/30 text-xs mt-10 italic">
                {searchQuery ? "لم يتم العثور على لاعبين" : "لا توجد محادثات سابقة."}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Main Chat Area */}
        <GlassCard className="flex flex-col overflow-hidden relative border-white/10">
          {activePlayer ? (
            <>
              <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-cyan-400">{filteredConversations.find(c => c.playerEmail === activePlayer)?.gosportUsername}</h3>
                  <p className="text-xs text-white/50">{activePlayer}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length > 0 ? (
                  messages.map((m) => {
                    const isSystem = m.senderRole === "system";
                    const isMe = m.senderRole === "agent";

                    if (isSystem) {
                      return (
                        <div key={m.id} className="flex justify-center my-4">
                          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-5 py-2.5 rounded-full flex items-center gap-2">
                            {m.message.includes("✅") ? <CheckCircle size={14} /> : <Info size={14} />}
                            <span className="font-semibold">{m.message}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${isMe ? "bg-cyan-600 text-white rounded-tr-sm" : "bg-white/10 text-white/90 rounded-tl-sm border border-white/5"}`}>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <p className={`text-[10px] mt-2 font-mono ${isMe ? 'text-cyan-200/70 text-right' : 'text-white/40 text-left'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 italic font-mono">
                    <p>No messages yet.</p>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              <div className="p-4 border-t border-white/10 bg-black/40 flex items-end gap-3">
                <TextArea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="رد على اللاعب..."
                  className="min-h-[55px] max-h-[120px] bg-white/5 border-white/10 rounded-2xl"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <PrimaryButton onClick={handleSend} disabled={!newMessage.trim()} className="h-[55px] px-6 rounded-2xl bg-cyan-500 text-black font-bold">
                  <Send size={20} />
                </PrimaryButton>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/20">
              <MessageCircle size={72} className="mb-6 opacity-10" />
              <p className="text-lg font-semibold">اختر لاعباً للبدء</p>
            </div>
          )}
        </GlassCard>
      </div>
    </SidebarShell>
  );
}