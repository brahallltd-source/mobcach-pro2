"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
  TextField,
} from "@/components/ui";
import { usePlayerTx } from "@/hooks/usePlayerTx";

type Complaint = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply?: string;
  created_at: string;
};

export default function PlayerComplaintsPage() {
  const tp = usePlayerTx();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (playerEmail: string) => {
    const res = await fetch(`/api/player/complaints?email=${encodeURIComponent(playerEmail)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setItems(data.complaints || []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    setEmail(user.email);
    load(user.email).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/player/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerEmail: email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(String(data.message || tp("complaints.alertFailed")));
        setSaving(false);
        return;
      }
      setSubject("");
      setMessage("");
      await load(email);
      toast.success(String(data.message || tp("complaints.alertSuccess")));
    } catch {
      toast.error(tp("complaints.alertNetwork"));
    }
    setSaving(false);
  };

  return (
    <SidebarShell role="player">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={tp("complaints.title")}
          subtitle={tp("complaints.subtitle")}
        />
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-6">
            <h2 className="text-2xl font-semibold text-balance">{tp("complaints.newTitle")}</h2>
            <div className="mt-5 space-y-4">
              <TextField value={email} disabled />
              <TextField
                placeholder={tp("complaints.subjectPlaceholder")}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <TextArea
                rows={7}
                placeholder={tp("complaints.messagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <PrimaryButton onClick={() => void submit()} disabled={saving} className="w-full min-h-[2.75rem]">
                {saving ? tp("complaints.sending") : tp("complaints.send")}
              </PrimaryButton>
            </div>
          </GlassCard>
          <GlassCard className="p-6">
            <h2 className="text-2xl font-semibold text-balance">{tp("complaints.myTitle")}</h2>
            <div className="mt-5 space-y-4">
              {loading ? (
                <p className="text-white/55">{tp("complaints.loadingList")}</p>
              ) : items.length === 0 ? (
                <p className="text-white/55">{tp("complaints.empty")}</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <h3 className="min-w-0 font-semibold text-balance">{item.subject}</h3>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/65">{item.message}</p>
                    {item.admin_reply ? (
                      <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/75">
                        <span className="font-semibold text-white">{tp("complaints.adminReply")}</span>{" "}
                        {item.admin_reply}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-white/35">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}
