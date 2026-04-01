"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DangerButton, GlassCard, PageHeader, PrimaryButton, SidebarShell, TextField } from "@/components/ui";
import { useLanguage } from "@/components/language";

type CurrentUser = { id: string; email: string; role: string };
type PlayerProfile = { user_id: string; email: string; first_name: string; last_name: string; username: string; phone: string; city: string; country: string; date_of_birth: string; status: string; assigned_agent_id: string };

export default function PlayerProfilePage() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const loadProfile = async (userEmail: string) => {
    const res = await fetch(`/api/player/profile?email=${encodeURIComponent(userEmail)}`, { cache: "no-store" });
    const data = await res.json();
    setProfile(data.profile || null);
    if (data.profile) {
      setEmail(data.profile.email || "");
      setPhone(data.profile.phone || "");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const parsed: CurrentUser = JSON.parse(saved);
    if (parsed.role !== "player") return void (window.location.href = "/login");
    setCurrentUser(parsed);
    loadProfile(parsed.email).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/player/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentEmail: currentUser.email, newEmail: email, newPhone: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to update profile");
        setSaving(false);
        return;
      }
      if (data.user) {
        localStorage.setItem("mobcash_user", JSON.stringify(data.user));
        setCurrentUser(data.user);
      }
      await loadProfile(data.user?.email || email);
      alert(data.message || "Profile updated");
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setSaving(false);
  };

  const logout = () => {
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("mobcash_user");
      window.location.href = "/login";
    });
  };

  if (loading) return <SidebarShell role="player"><GlassCard className="p-12 text-center">Loading profile...</GlassCard></SidebarShell>;
  if (!profile) return <SidebarShell role="player"><GlassCard className="p-12 text-center">Profile not found.</GlassCard></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader title={t("myProfile")} subtitle="Update your contact information, switch your assigned agent and access logout in one clear place." />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <GlassCard className="p-6">
          <h2 className="text-2xl font-semibold">Basic information</h2>
          <div className="mt-5 grid gap-3 text-sm text-white/75">
            <p><span className="text-white/45">First Name:</span> {profile.first_name}</p>
            <p><span className="text-white/45">Last Name:</span> {profile.last_name}</p>
            <p><span className="text-white/45">Username:</span> {profile.username}</p>
            <p><span className="text-white/45">Date of Birth:</span> {profile.date_of_birth}</p>
            <p><span className="text-white/45">City:</span> {profile.city}</p>
            <p><span className="text-white/45">Country:</span> {profile.country}</p>
            <p><span className="text-white/45">Status:</span> {profile.status}</p>
            <p><span className="text-white/45">Assigned Agent ID:</span> {profile.assigned_agent_id || "Not assigned"}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="text-2xl font-semibold">Editable contact info</h2>
          <div className="mt-5 space-y-4">
            <TextField type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <PrimaryButton onClick={save} disabled={saving} className="w-full">{saving ? "Saving..." : "Save changes"}</PrimaryButton>
            <Link href="/player/select-agent" className="block">
              <PrimaryButton className="w-full bg-cyan-200 text-slate-950 hover:bg-cyan-100">{t("changeAgent")}</PrimaryButton>
            </Link>
            <DangerButton onClick={logout} className="w-full">Logout</DangerButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
