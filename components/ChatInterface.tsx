"use client";

import { clsx } from "clsx";
import {
  ArrowLeft,
  CheckCircle,
  Info,
  Paperclip,
  SendHorizontal,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui";

export type ChatRole = "player" | "agent";

export type ChatContactDto = {
  id: string;
  name: string;
  subtitle?: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;
  isOnline: boolean;
  lastSeenIso?: string | null;
};

export type ChatMessageDto = {
  id: string;
  senderRole: string;
  message: string;
  created_at: string;
};

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function formatListTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString("ar-MA", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "أمس";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString("ar-MA", { weekday: "short" });
  }
  return d.toLocaleDateString("ar-MA", { day: "numeric", month: "short" });
}

function formatLastSeenLine(contact: ChatContactDto): string {
  if (contact.isOnline) return "متصل الآن";
  const raw = contact.lastSeenIso;
  if (!raw) return "غير متصل";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "آخر ظهور غير معروف";
  const ago = Date.now() - d.getTime();
  if (ago < ONLINE_WINDOW_MS) return "متصل الآن";
  const when = d.toLocaleString("ar-MA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `آخر ظهور: ${when}`;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type ChatInterfaceProps = {
  role: ChatRole;
  /** Normalized player email for `listRole=player` and send. */
  playerEmail: string | null;
  /** Agent id for `listRole=agent` and message thread. */
  agentId: string | null;
  /** Deep-link: `agentId` (player) or `playerEmail` (agent). */
  initialContactId?: string | null;
  listHeading: string;
  emptyListHint: string;
  composerPlaceholder: string;
  /** Agent inbox: search contacts by email / gosport. */
  showContactSearch?: boolean;
};

export function ChatInterface({
  role,
  playerEmail,
  agentId,
  initialContactId,
  listHeading,
  emptyListHint,
  composerPlaceholder,
  showContactSearch = false,
}: ChatInterfaceProps) {
  const [contacts, setContacts] = useState<ChatContactDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialContactId ?? null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; read: boolean; title: string }>>([]);
  const [narrow, setNarrow] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mySenderRole = role === "player" ? "player" : "agent";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (initialContactId) setSelectedId(initialContactId);
  }, [initialContactId]);

  /** Deep-link on mobile: open thread when URL pre-selects a contact. */
  useEffect(() => {
    if (narrow && initialContactId && selectedId === initialContactId) {
      setMobileChatOpen(true);
    }
  }, [narrow, initialContactId, selectedId]);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?for=me&limit=50", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      const raw = (data.notifications || []) as Array<{ id: string; read?: boolean; isRead?: boolean; title: string }>;
      setNotifications(
        raw.map((n) => ({
          id: n.id,
          read: Boolean(n.read ?? n.isRead),
          title: n.title,
        }))
      );
    } catch {
      /* ignore */
    }
  }, []);

  const loadContacts = useCallback(async () => {
    const listEmail = role === "player" ? playerEmail : agentId;
    if (!listEmail) return;
    try {
      const res = await fetch(
        `/api/order-messages?listRole=${role}&userEmail=${encodeURIComponent(listEmail)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const next = (data.contacts || []) as ChatContactDto[];
      setContacts(next);
    } catch {
      setContacts([]);
    } finally {
      setLoadingList(false);
    }
  }, [role, playerEmail, agentId]);

  const loadMessages = useCallback(
    async (contactId: string) => {
      const pe = role === "player" ? playerEmail : null;
      const aid = role === "player" ? contactId : agentId;
      const playerForThread = role === "player" ? pe : contactId;
      if (!playerForThread || !aid) return;
      try {
        const res = await fetch(
          `/api/order-messages?playerEmail=${encodeURIComponent(playerForThread)}&agentId=${encodeURIComponent(aid)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setMessages((data.messages || []) as ChatMessageDto[]);
      } catch {
        setMessages([]);
      }
    },
    [role, playerEmail, agentId]
  );

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    void fetchNotifs();
  }, [fetchNotifs]);

  useEffect(() => {
    if (!selectedId) return;
    if (role === "player" && !playerEmail) return;
    if (role === "agent" && !agentId) return;
    void loadMessages(selectedId);
    void markAllAsRead();
  }, [selectedId, role, playerEmail, agentId, loadMessages, markAllAsRead]);

  useEffect(() => {
    const listEmail = role === "player" ? playerEmail : agentId;
    if (!listEmail) return;
    const t = setInterval(() => {
      void loadContacts();
      void fetchNotifs();
      if (selectedId) void loadMessages(selectedId);
    }, 4000);
    return () => clearInterval(t);
  }, [role, playerEmail, agentId, selectedId, loadContacts, loadMessages, fetchNotifs]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, selectedId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`;
  }, [newMessage]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId]
  );

  const playerUnreadTotal = useMemo(
    () => (role === "player" ? notifications.filter((n) => !n.read).length : 0),
    [notifications, role]
  );

  const unreadForContact = useCallback(
    (c: ChatContactDto) => {
      if (role === "agent") {
        return notifications.filter((n) => !n.read && n.title.includes(c.id)).length;
      }
      return 0;
    },
    [notifications, role]
  );

  const handleSelectContact = (id: string) => {
    setSelectedId(id);
    if (narrow) setMobileChatOpen(true);
  };

  const handleBack = () => {
    setMobileChatOpen(false);
  };

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !selectedId) return;
    if (role === "player" && !playerEmail) return;
    if (role === "agent" && !agentId) return;

    setNewMessage("");
    try {
      await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderRole: mySenderRole,
          playerEmail: role === "player" ? playerEmail : selectedId,
          agentId: role === "player" ? selectedId : agentId,
          message: text,
        }),
      });
      await loadMessages(selectedId);
      await loadContacts();
    } catch {
      /* ignore */
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if ((role === "player" && !playerEmail) || (role === "agent" && !agentId)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/50">
        جاري تهيئة الجلسة…
      </div>
    );
  }

  const showList = !narrow || !mobileChatOpen;
  const showChat = !narrow || mobileChatOpen;

  return (
    <div
      className={clsx(
        "relative grid min-h-[min(720px,calc(100dvh-13rem))] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#040910]/95 shadow-2xl shadow-black/50",
        "md:grid-cols-[minmax(0,320px)_1fr] md:gap-0"
      )}
    >
      {/* —— Contact list —— */}
      <aside
        className={clsx(
          "flex min-h-0 flex-col border-white/10 bg-[#060d18]/95 md:border-e",
          narrow && !showList && "hidden",
          !narrow && "flex"
        )}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-cyan-300/95">{listHeading}</p>
            {playerUnreadTotal > 0 ? (
              <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {playerUnreadTotal > 99 ? "99+" : playerUnreadTotal}
              </span>
            ) : null}
          </div>
          {showContactSearch ? (
            <div className="relative mt-3">
              <TextField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالإيميل أو الاسم…"
                className="w-full rounded-xl border-white/10 bg-black/40 py-2.5 ps-3 pe-3 text-sm text-white placeholder:text-white/35"
              />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadingList ? (
            <p className="py-8 text-center text-sm text-white/45">جاري التحميل…</p>
          ) : filteredContacts.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">{emptyListHint}</p>
          ) : (
            <ul className="space-y-1.5">
              {filteredContacts.map((c) => {
                const active = c.id === selectedId;
                const unread = unreadForContact(c);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectContact(c.id)}
                      className={clsx(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-start transition",
                        active
                          ? "bg-cyan-500/15 ring-1 ring-cyan-400/25"
                          : "hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={clsx(
                            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold",
                            active ? "bg-cyan-500/25 text-cyan-100" : "bg-white/10 text-white/70"
                          )}
                        >
                          {(c.name || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <span
                          className={clsx(
                            "absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-[#060d18]",
                            c.isOnline ? "bg-emerald-400" : "bg-zinc-500"
                          )}
                          title={c.isOnline ? "متصل" : "غير متصل"}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-white">{c.name}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                            {formatListTimestamp(c.lastMessageAt)}
                          </span>
                        </div>
                        {c.subtitle ? (
                          <p className="truncate text-[11px] text-white/45">{c.subtitle}</p>
                        ) : null}
                        <p className="mt-0.5 truncate text-xs text-white/50">
                          {c.lastMessagePreview || "—"}
                        </p>
                        {unread > 0 && !active ? (
                          <span className="mt-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* —— Active thread —— */}
      <section
        className={clsx(
          "flex min-h-0 min-w-0 flex-col border-white/10 bg-[#050a12]/98 md:border-s-0",
          narrow && !showChat && "hidden",
          !narrow && "flex"
        )}
      >
        {selectedId && activeContact ? (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/25 px-3 py-3 md:px-4">
              {narrow ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="shrink-0 px-2 text-white"
                  onClick={handleBack}
                  aria-label="رجوع للقائمة"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <div className="relative shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-600/25 text-sm font-bold text-white">
                  {(activeContact.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <span
                  className={clsx(
                    "absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-[#050a12]",
                    activeContact.isOnline ? "bg-emerald-400" : "bg-zinc-500"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-white md:text-lg">{activeContact.name}</h2>
                <p
                  className={clsx(
                    "truncate text-xs",
                    activeContact.isOnline ? "text-emerald-300/90" : "text-white/45"
                  )}
                >
                  {formatLastSeenLine(activeContact)}
                </p>
              </div>
            </header>

            <div
              ref={messagesScrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5"
              dir="ltr"
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-white/35">
                    <User className="h-10 w-10 opacity-30" />
                    <p className="text-sm">لا رسائل بعد. ابدأ المحادثة…</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    if (m.senderRole === "system") {
                      return (
                        <div key={m.id} className="flex justify-center py-2">
                          <div className="inline-flex max-w-[95%] items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-200">
                            {m.message.includes("✅") ? (
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Info className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="text-center">{m.message}</span>
                          </div>
                        </div>
                      );
                    }
                    const isMe = m.senderRole === mySenderRole;
                    return (
                      <div key={m.id} className={clsx("flex w-full", isMe ? "justify-end" : "justify-start")}>
                        <div
                          className={clsx(
                            "max-w-[min(85%,28rem)] px-4 py-2.5 text-sm leading-relaxed shadow-md",
                            isMe
                              ? "rounded-2xl rounded-br-md bg-cyan-600 text-white"
                              : "rounded-2xl rounded-bl-md bg-zinc-800 text-white ring-1 ring-white/10"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          <p
                            className={clsx(
                              "mt-1.5 text-[10px] tabular-nums",
                              isMe ? "text-cyan-100/75" : "text-white/45"
                            )}
                          >
                            {new Date(m.created_at).toLocaleTimeString("ar-MA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
              </div>
            </div>

            <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-[#040910]/95 px-3 py-3 backdrop-blur-md md:px-4">
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-11 shrink-0 px-3 text-white/60 hover:text-white"
                  aria-label="إرفاق مستند (قريباً)"
                  disabled
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={composerPlaceholder}
                  className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                />
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  className="h-11 shrink-0 bg-cyan-500 px-4 text-slate-950 hover:bg-cyan-400"
                  onClick={() => void handleSend()}
                  disabled={!newMessage.trim()}
                  aria-label="إرسال"
                >
                  <SendHorizontal className="h-5 w-5" />
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center text-white/30">
            <User className="h-14 w-14 opacity-20" />
            <p className="text-base font-medium text-white/50">اختر محادثة للبدء</p>
            <p className="max-w-xs text-sm text-white/35">جهات الاتصال تظهر هنا بعد أول طلب أو رسالة.</p>
          </div>
        )}
      </section>
    </div>
  );
}
