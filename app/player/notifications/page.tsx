"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";

type Notification = { 
  id: string; 
  title: string; 
  message: string; 
  read: boolean; 
  createdAt: string; 
};

export default function PlayerNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);

    const role = String(user.role).toLowerCase();
    
    // 💡 هادي هي "الشبكة" اللي غتصيد الإيميل بأي طريقة كان مكتوب بيها
    const target = role === "agent" 
      ? (user.agentId || user.id || "") 
      : (user.email || user.playerEmail || user.id || "");

    // 🕵️‍♂️ هاد السطر غادي يطبع لينا فالمتصفح شنو لقى بالضبط
    console.log("🔍 DEBUG NOTIFICATIONS:", { 
      extractedRole: role, 
      extractedTarget: target,
      originalUserData: user 
    });

    if (!target) {
      console.error("❌ Target ID (Email) is missing from local storage!");
      setLoading(false);
      return;
    }

    fetch(`/api/notifications?role=${encodeURIComponent(role)}&targetId=${encodeURIComponent(target)}`, { 
      cache: "no-store" 
    })
      .then((res) => res.json())
      .then((data) => setItems(data.notifications || []))
      .catch((err) => console.error("Fetch Error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarShell role="player"><LoadingCard text="جاري تحميل الإشعارات..." /></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader 
        title="الإشعارات (Notifications)" 
        subtitle="توصل بآخر التحديثات حول طلباتك، عمليات الشحن، والرسائل الجديدة من الوكلاء." 
      />
      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className={`p-6 border-l-4 ${!item.read ? 'border-l-cyan-500 bg-white/5' : 'border-l-transparent'}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 ${!item.read ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-cyan-400/10 text-cyan-100'}`}>
                <BellRing size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className={`text-lg ${!item.read ? 'font-bold text-white' : 'font-semibold text-white/80'}`}>
                    {item.title}
                  </h3>
                  <span className="text-xs uppercase tracking-[0.1em] text-white/40 font-mono">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Date unavailable"}
                  </span>
                </div>
                <p className={`mt-2 text-sm leading-6 ${!item.read ? 'text-white/80' : 'text-white/50'}`}>
                  {item.message}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? (
          <GlassCard className="p-10 text-center text-white/40">
            <BellRing size={48} className="mx-auto mb-4 opacity-20" />
            لا توجد إشعارات حالياً.
          </GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}