"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";

type User = {
  id: string;
  email: string;
  role: string;
};

type WinningOrder = {
  id: string;
  amount: number;
  gosport365_username?: string;
  status: string;
  created_at?: string;
};

type WithdrawalItem = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at?: string;
  cashProvider?: string;
  rib?: string;
  swift?: string;
  gosportUsername?: string;
};

export default function PlayerWinningsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [winning, setWinning] = useState<WinningOrder | null>(null);
  const [history, setHistory] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<"bank" | "cash">("bank");

  const [form, setForm] = useState({
    amount: "",
    rib: "",
    ribConfirm: "",
    swift: "",
    swiftConfirm: "",
    cashProvider: "Cash Express",
    fullName: "",
    phone: "",
    city: "",
    gosportUsername: "",
    gosportUsernameConfirm: "",
    gosportPassword: "",
    gosportPasswordConfirm: "",
  });

  const load = async (email: string) => {
    const res = await fetch(
      `/api/player/winnings?playerEmail=${encodeURIComponent(email)}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    setWinning(data.winning || null);
    setHistory(data.history || []);

    if (data.winning) {
      setForm((prev) => ({
        ...prev,
        amount: "",
        gosportUsername:
          data.winning.gosport365_username || prev.gosportUsername,
      }));
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) {
      window.location.href = "/login";
      return;
    }

    const current: User = JSON.parse(saved);
    if (current.role !== "player") {
      window.location.href = "/login";
      return;
    }

    setUser(current);
    load(current.email).finally(() => setLoading(false));
  }, []);

  const pendingRequest = useMemo(
    () =>
      history.find((item) =>
        ["pending", "sent", "completed"].includes(String(item.status || ""))
      ),
    [history]
  );

  const submit = async () => {
    if (!user || !winning) return;

    const amount = Number(form.amount || 0);

    if (!amount || amount <= 0) {
      return alert("Winning amount is required");
    }

    if (amount > Number(winning.amount || 0)) {
      return alert("Winning amount cannot exceed the available winning balance");
    }

    if (!form.gosportUsername.trim()) {
      return alert("GoSport365 username is required");
    }
    if (form.gosportUsername !== form.gosportUsernameConfirm) {
      return alert("GoSport365 username confirmation does not match");
    }
    if (!form.gosportPassword.trim()) {
      return alert("GoSport365 password is required");
    }
    if (form.gosportPassword !== form.gosportPasswordConfirm) {
      return alert("GoSport365 password confirmation does not match");
    }

    if (method === "bank") {
      if (!form.rib.trim() || !form.swift.trim()) {
        return alert("RIB and SWIFT are required");
      }
      if (form.rib !== form.ribConfirm) {
        return alert("RIB confirmation does not match");
      }
      if (form.swift !== form.swiftConfirm) {
        return alert("SWIFT confirmation does not match");
      }
    } else {
      if (!form.fullName.trim() || !form.phone.trim() || !form.city.trim()) {
        return alert("Cash withdrawal fields are required");
      }
    }

    try {
      setSaving(true);

      const res = await fetch("/api/player/winnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail: user.email,
          orderId: winning.id,
          amount,
          method,
          gosportUsername: form.gosportUsername,
          gosportPassword: form.gosportPassword,
          rib: form.rib,
          swift: form.swift,
          cashProvider: form.cashProvider,
          fullName: form.fullName,
          phone: form.phone,
          city: form.city,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to submit payout request");
        return;
      }

      await load(user.email);
      alert(data.message || "Winning payout request sent to admin");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading winnings..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="My winnings"
        subtitle="Enter the amount you want to withdraw, add GoSport365 credentials and send the payout request directly to admin."
      />

      {!winning ? (
        <GlassCard className="p-10 text-center">
          No winning prize is available on this account yet.
        </GlassCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Available winning"
              value={`${winning.amount} DH`}
              hint="Maximum amount you can request"
            />
            <StatCard
              label="Order status"
              value={winning.status}
              hint="Winning source order"
            />
            <StatCard
              label="Payout request"
              value={pendingRequest ? pendingRequest.status : "not started"}
              hint={
                pendingRequest
                  ? "Already sent to admin"
                  : "Fill the form below and send"
              }
            />
            <StatCard
              label="History"
              value={String(history.length)}
              hint="Winner payout requests on this account"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="p-6 md:p-8">
              <h2 className="text-2xl font-semibold">Winning payout request</h2>

              <div className="mt-6 grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Winning amount (DH)
                  </label>
                  <TextField
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="Enter the amount you want to withdraw"
                  />
                  <p className="text-xs text-white/50">
                    Available: {winning.amount} DH
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      GoSport365 Username
                    </label>
                    <TextField
                      value={form.gosportUsername}
                      onChange={(e) =>
                        setForm({ ...form, gosportUsername: e.target.value })
                      }
                      placeholder="Enter GoSport365 username"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Confirm GoSport365 Username
                    </label>
                    <TextField
                      value={form.gosportUsernameConfirm}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          gosportUsernameConfirm: e.target.value,
                        })
                      }
                      placeholder="Confirm GoSport365 username"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      GoSport365 Password
                    </label>
                    <TextField
                      type="password"
                      value={form.gosportPassword}
                      onChange={(e) =>
                        setForm({ ...form, gosportPassword: e.target.value })
                      }
                      placeholder="Enter GoSport365 password"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Confirm GoSport365 Password
                    </label>
                    <TextField
                      type="password"
                      value={form.gosportPasswordConfirm}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          gosportPasswordConfirm: e.target.value,
                        })
                      }
                      placeholder="Confirm GoSport365 password"
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setMethod("bank")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      method === "bank"
                        ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                        : "border-white/10 bg-black/20 text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="font-semibold">Bank transfer</div>
                    <p className="mt-2 text-sm text-white/55">
                      Use RIB and SWIFT.
                    </p>
                  </button>

                  <button
                    onClick={() => setMethod("cash")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      method === "cash"
                        ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                        : "border-white/10 bg-black/20 text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="font-semibold">Cash withdrawal</div>
                    <p className="mt-2 text-sm text-white/55">
                      Cash Express / Cash Plus / Wafacash.
                    </p>
                  </button>
                </div>

                {method === "bank" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        RIB
                      </label>
                      <TextField
                        value={form.rib}
                        onChange={(e) =>
                          setForm({ ...form, rib: e.target.value })
                        }
                        placeholder="Enter full RIB"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Confirm RIB
                      </label>
                      <TextField
                        value={form.ribConfirm}
                        onChange={(e) =>
                          setForm({ ...form, ribConfirm: e.target.value })
                        }
                        placeholder="Confirm full RIB"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        SWIFT
                      </label>
                      <TextField
                        value={form.swift}
                        onChange={(e) =>
                          setForm({ ...form, swift: e.target.value })
                        }
                        placeholder="Enter SWIFT"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Confirm SWIFT
                      </label>
                      <TextField
                        value={form.swiftConfirm}
                        onChange={(e) =>
                          setForm({ ...form, swiftConfirm: e.target.value })
                        }
                        placeholder="Confirm SWIFT"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Cash provider
                      </label>
                      <select
                        value={form.cashProvider}
                        onChange={(e) =>
                          setForm({ ...form, cashProvider: e.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                      >
                        <option>Cash Express</option>
                        <option>Cash Plus</option>
                        <option>Wafacash</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Full name
                      </label>
                      <TextField
                        value={form.fullName}
                        onChange={(e) =>
                          setForm({ ...form, fullName: e.target.value })
                        }
                        placeholder="Receiver full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Phone
                      </label>
                      <TextField
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        placeholder="Receiver phone"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        City
                      </label>
                      <TextField
                        value={form.city}
                        onChange={(e) =>
                          setForm({ ...form, city: e.target.value })
                        }
                        placeholder="City"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  This request is sent directly to admin payouts. Agent approval is not required for winnings.
                </div>

                <PrimaryButton
                  onClick={submit}
                  disabled={saving}
                  className="w-full md:w-auto"
                >
                  {saving ? "Submitting..." : "Send payout request to admin"}
                </PrimaryButton>
              </div>
            </GlassCard>

            <GlassCard className="p-6 md:p-8">
              <h2 className="text-2xl font-semibold">Winning payout history</h2>
              <div className="mt-5 space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{item.amount} DH</p>
                        <p className="mt-1 text-sm text-white/55">
                          {item.method === "bank"
                            ? "Bank transfer"
                            : item.cashProvider || "Cash withdrawal"}
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : "—"}
                        </p>
                      </div>

                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                        {String(item.status || "").replaceAll("_", " ")}
                      </div>
                    </div>
                  </div>
                ))}
                {!history.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">
                    No payout history yet.
                  </div>
                ) : null}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </SidebarShell>
  );
}