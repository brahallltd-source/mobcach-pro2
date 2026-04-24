"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { GlassCard, PageHeader, PrimaryButton, Shell, StatusBadge, TextArea } from "@/components/ui";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { becomeAgentApplicationSchema, type BecomeAgentApplicationValues } from "@/lib/validations/auth";

type AppRecord = {
  id: string;
  fullName?: string;
  email: string;
  phone?: string;
  note?: string;
  status: string;
  createdAt?: string;
};

type SessionUser = { id: string; email?: string; username?: string; role?: string };

export default function PlayerBecomeAgentPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [current, setCurrent] = useState<AppRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<BecomeAgentApplicationValues>({
    resolver: zodResolver(becomeAgentApplicationSchema),
    defaultValues: {
      userId: "",
      username: "",
      name: "",
      email: "",
      phone: "",
      country: "Morocco",
      city: "",
      dateOfBirth: "",
      note: "",
    },
  });

  const load = async (user: SessionUser) => {
    const params = new URLSearchParams();
    if (user.id) params.set("userId", user.id);
    if (user.email) params.set("email", user.email);
    const res = await fetch(`/api/player/become-agent?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setCurrent(data.application || null);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved) as SessionUser & { role?: string };
    if (String(user.role ?? "").toLowerCase() !== "player") return void (window.location.href = "/login");
    setSessionUser(user);
    form.reset({
      userId: user.id,
      username: user.username ?? "",
      name: "",
      email: user.email ?? "",
      phone: "",
      country: "Morocco",
      city: "",
      dateOfBirth: "",
      note: "",
    });
    void load(user).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once; form methods stable
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const res = await fetch("/api/player/become-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; application?: AppRecord | null };
      if (!res.ok) {
        toast.error(typeof data.message === "string" ? data.message : "تعذّر إرسال الطلب");
        return;
      }
      setCurrent(data.application || null);
      toast.success(typeof data.message === "string" ? data.message : "تم إرسال الطلب");
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setSaving(false);
    }
  });

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl">
          <GlassCard className="border-primary/25 bg-white/[0.04] p-12 text-center shadow-xl backdrop-blur-md">
            <p className="text-white/70">جاري التحميل…</p>
          </GlassCard>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="طلب الانضمام كوكيل"
          subtitle="أكمل بيانات التحقق (البلد، المدينة، تاريخ الميلاد). يجب أن يكون عمرك 18 عاماً أو أكثر."
        />
        {current ? (
          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">تم استلام الطلب</h2>
              <StatusBadge status={current.status} />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-white/70">
              <p>
                <span className="text-white/45">الاسم:</span> {current.fullName || "—"}
              </p>
              <p>
                <span className="text-white/45">البريد:</span> {current.email}
              </p>
              <p>
                <span className="text-white/45">الهاتف:</span> {current.phone || "—"}
              </p>
              <p>
                <span className="text-white/45">ملاحظة:</span> {current.note || "—"}
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>الاسم الكامل *</FormLabel>
                        <FormControl>
                          <Input placeholder="الاسم الثلاثي" autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الهاتف *</FormLabel>
                        <FormControl>
                          <Input placeholder="+212…" autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البريد الإلكتروني *</FormLabel>
                        <FormControl>
                          <Input type="email" disabled readOnly className="opacity-80" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البلد *</FormLabel>
                        <FormControl>
                          <Input placeholder="المغرب" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المدينة *</FormLabel>
                        <FormControl>
                          <Input placeholder="الدار البيضاء" autoComplete="address-level2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>تاريخ الميلاد *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظة (اختياري)</FormLabel>
                      <FormControl>
                        <TextArea rows={5} placeholder="خبرنا عن خبرتك أو أي تفاصيل إضافية" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PrimaryButton type="submit" disabled={saving} className="w-full md:w-auto">
                  {saving ? "جاري الإرسال…" : "إرسال الطلب"}
                </PrimaryButton>
              </form>
            </Form>
          </GlassCard>
        )}
      </div>
    </Shell>
  );
}
