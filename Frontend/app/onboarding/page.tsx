"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { streamChat, api, type Profile } from "@/lib/api";
import {
  CheckCircle2,
  Compass,
  Send,
  User,
  Briefcase,
  MapPin,
  Star,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function profileProgress(p: Profile | null): number {
  if (!p) return 0;
  if (p.completed) return 100;
  let score = 0;
  if (p.target_role) score += 30;
  if (p.city || p.remote_only) score += 25;
  if (p.level) score += 15;
  if (p.experience_years !== undefined && p.experience_years !== null) score += 15;
  if (p.skills?.length) score += 15;
  return Math.min(score, 100);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "سلام! 👋 من همراه کاریابی تو هستم.\n\nتا بهترین موقعیت‌های شغلی رو برات گلچین کنم، بگو:\n• چه حوزه‌ای می‌خوای کار کنی؟ (مثلاً دیتا ساینس، فرانت‌اند، دواپس)\n• ساکن کجایی یا دورکاری می‌خوای؟\n• سطحت چیه و سابقه کار داری یا نه؟\n\nمی‌تونی از دکمه‌های آماده پایین هم استفاده کنی یا برام بنویسی!",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial profile state
  useEffect(() => {
    api<Profile>("/accounts/profile/")
      .then((p) => {
        setProfile(p);
        if (p.completed) {
          router.replace("/jobs");
        }
      })
      .catch(() => {
        toast.error("لطفاً ابتدا وارد حساب کاربری خود شوید.");
        router.replace("/");
      });
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!busy && !redirecting) {
      inputRef.current?.focus();
    }
  }, [busy, redirecting]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy || redirecting) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);

    try {
      await streamChat(message, "onboarding", (event) => {
        if (event.type === "assistant" && event.text) {
          setMessages((m) => [...m, { role: "assistant", content: event.text! }]);
        }
      });

      const freshProfile = await api<Profile>("/accounts/profile/");
      setProfile(freshProfile);

      if (freshProfile.completed) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "🎉 عالیه! پروفایلت کامل شد. در حال هدایت به آگهی‌های منطبق با تخصص و موقعیت شما هستیم…",
          },
        ]);
        setRedirecting(true);
        toast.success("پروفایل کامل شد! هدایت به فرصت‌های شغلی…");
        setTimeout(() => router.push("/jobs"), 1800);
      }
    } catch {
      toast.error("خطا در ارتباط با سرور. دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  }

  // Dynamic suggestion chips based on what's still missing
  const suggestionChips = (() => {
    if (!profile?.target_role) {
      return [
        { label: "📊 دیتا ساینس", text: "دیتا ساینس" },
        { label: "💻 فرانت‌اند", text: "فرانت‌اند" },
        { label: "⚙️ بک‌اند", text: "بک‌اند" },
        { label: "☁️ دواپس", text: "دواپس" },
        { label: "🎨 طراح UI/UX", text: "طراح UI/UX" },
      ];
    }
    if (!profile?.city && !profile?.remote_only) {
      return [
        { label: "📍 شهرری", text: "شهرری زندگی می‌کنم" },
        { label: "🏙️ تهران", text: "تهران هستم" },
        { label: "🌐 دورکاری (ریموت)", text: "فقط دورکاری می‌خوام" },
        { label: "📍 کرج", text: "کرج هستم" },
        { label: "📍 اصفهان", text: "اصفهان هستم" },
      ];
    }
    if (profile?.experience_years === undefined || profile?.experience_years === null) {
      return [
        { label: "🌱 سابقه ندارم", text: "سابقه کاری ندارم" },
        { label: "🎯 میدلول هستم", text: "سطحم میدلوله" },
        { label: "⭐ ۲ سال تجربه", text: "۲ سال سابقه کار دارم" },
        { label: "🎓 کارآموزم", text: "کارآموز هستم" },
      ];
    }
    if (!profile?.level) {
      return [
        { label: "🎯 میدلول", text: "سطحم میدلول هست" },
        { label: "🚀 جونیور", text: "سطحم جونیور هست" },
        { label: "👑 سینیور", text: "سطحم سینیور هست" },
      ];
    }
    if (!profile?.skills?.length || profile.skills.length < 3) {
      if (profile.target_role.includes("دیتا") || profile.target_role.includes("data")) {
        return [
          { label: "🐍 Python", text: "پایتون و اس‌کیوال بلدم" },
          { label: "🤖 Machine Learning", text: "ماشین لرنینگ و یادگیری عمیق" },
          { label: "📊 Power BI", text: "پاور بی آی و اکسل بلدم" },
        ];
      }
      return [
        { label: "⚛️ React & Next.js", text: "ری‌اکت و نکست جی اس بلدم" },
        { label: "🐍 Python & Django", text: "پایتون و جنگو بلدم" },
        { label: "🐳 Docker & Git", text: "داکر و گیت بلدم" },
      ];
    }
    return [
      { label: "🚀 رفتن به آگهی‌ها", action: () => router.push("/jobs") },
    ];
  })();

  const progress = profileProgress(profile);

  return (
    <main className="flex-1 min-h-screen bg-gradient-to-br from-indigo-50 via-background to-slate-100 dark:from-slate-950 dark:via-background dark:to-slate-900">
      {/* Top bar */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="size-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Compass className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">همراه کاریابی — ساخت پروفایل و جستجوی شغل</div>
            <div className="flex items-center gap-2 mt-0.5">
              <Progress value={progress} className="h-1.5 flex-1 max-w-[160px]" />
              <span className="text-[11px] text-muted-foreground">{progress}٪ کامل</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/jobs")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0 font-medium"
          >
            مشاهده آگهی‌ها
            <ArrowRight className="size-3.5 mr-1.5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Chat panel */}
        <div className="flex flex-col gap-0">
          <Card className="shadow-md border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-0 flex flex-col">
              {/* Messages */}
              <div className="h-[calc(100vh-290px)] min-h-[420px] overflow-y-auto p-5 space-y-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      "flex items-end gap-2 " +
                      (m.role === "user" ? "justify-end" : "justify-start")
                    }
                  >
                    {m.role === "assistant" && (
                      <div className="size-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
                        <Compass className="size-3.5" />
                      </div>
                    )}
                    <div
                      className={
                        "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm " +
                        (m.role === "user"
                          ? "bg-indigo-600 text-white rounded-bl-sm"
                          : "bg-slate-100 text-slate-800 rounded-br-sm dark:bg-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50")
                      }
                    >
                      {m.content}
                    </div>
                    {m.role === "user" && (
                      <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
                        <User className="size-3.5 text-slate-600 dark:text-slate-300" />
                      </div>
                    )}
                  </div>
                ))}

                {busy && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="size-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Compass className="size-3.5" />
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-br-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                      <span className="size-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                      <span className="size-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                      <span className="size-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                {redirecting && (
                  <div className="flex justify-center">
                    <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 rounded-2xl px-5 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shadow-sm">
                      <CheckCircle2 className="size-4 shrink-0 animate-pulse" />
                      در حال انتقال به آگهی‌های شغلی مناسب شما…
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggestions chips */}
              <div className="px-4 pt-2.5 pb-1 border-t bg-slate-50/70 dark:bg-slate-900/50 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium ml-1">پیشنهاد سریع:</span>
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={busy || redirecting}
                    onClick={() => {
                      if ("action" in chip && chip.action) {
                        chip.action();
                      } else if ("text" in chip && chip.text) {
                        send(chip.text);
                      }
                    }}
                    className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-900/50 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs font-medium cursor-pointer disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 bg-background border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      redirecting
                        ? "در حال انتقال به آگهی‌ها…"
                        : busy
                        ? "در حال پردازش پیام…"
                        : "مثلاً: دیتا ساینس، شهرری، سطحم میدلول و سابقه ندارم…"
                    }
                    disabled={busy || redirecting}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={busy || redirecting || !input.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 shrink-0"
                  >
                    <Send className="size-4 rotate-180" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/jobs")}
                    className="shrink-0 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="مشاهده آگهی‌های شغلی"
                  >
                    آگهی‌ها
                  </Button>
                </form>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 px-1">
                  <span>هم با تایپ کردن و هم با کلیک روی گزینه‌ها می‌تونی پروفایلت رو کامل کنی</span>
                  <button
                    type="button"
                    onClick={() => router.push("/jobs")}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                  >
                    مستقیم برو به آگهی‌ها ←
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live profile sidebar */}
        <div className="space-y-4 sticky top-[72px]">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
              <div className="text-white text-sm font-semibold">پروفایل در حال ساخت</div>
              <div className="text-indigo-200 text-[11px] mt-0.5">
                {progress === 100
                  ? "✓ تکمیل شد — آماده برای دریافت آگهی"
                  : `${progress}٪ — اطلاعاتت در حال ثبت است`}
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              {/* Target Role */}
              <ProfileField
                icon={<Briefcase className="size-3.5" />}
                label="نقش هدف"
                value={profile?.target_role}
                placeholder="هنوز تعیین نشده"
              />
              {/* Level */}
              <ProfileField
                icon={<Star className="size-3.5" />}
                label="سطح"
                value={
                  profile?.level
                    ? {
                        intern: "کارآموز",
                        junior: "جونیور",
                        mid: "میان‌رده (Mid-level)",
                        senior: "ارشد (Senior)",
                      }[profile.level] || profile.level
                    : undefined
                }
                placeholder="هنوز تعیین نشده"
              />
              {/* Experience */}
              <ProfileField
                icon={<Clock className="size-3.5" />}
                label="سابقه کار"
                value={
                  profile?.experience_years !== undefined && profile?.experience_years !== null
                    ? (profile.experience_years === 0 ? "بدون سابقه کاری (صفر)" : `${profile.experience_years} سال`)
                    : undefined
                }
                placeholder="هنوز تعیین نشده"
              />
              {/* City */}
              <ProfileField
                icon={<MapPin className="size-3.5" />}
                label="شهر / موقعیت"
                value={profile?.city || (profile?.remote_only ? "دورکاری (ریموت)" : undefined)}
                placeholder="هنوز تعیین نشده"
              />

              {/* Skills */}
              <div>
                <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">مهارت‌ها</div>
                {profile?.skills && profile.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {profile.skills.slice(0, 8).map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50"
                      >
                        {s}
                      </Badge>
                    ))}
                    {profile.skills.length > 8 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                        +{profile.skills.length - 8}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    هنوز مهارتی ثبت نشده
                  </div>
                )}
              </div>

              {/* Completion bar */}
              <div className="pt-2 border-t dark:border-slate-700">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">میزان تکمیل</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {progress}٪
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Always-visible Go to Jobs Button in Sidebar */}
          <Button
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md font-medium py-5 cursor-pointer"
            onClick={() => router.push("/jobs")}
          >
            مشاهده آگهی‌های شغلی
            <ArrowRight className="size-4 mr-2" />
          </Button>
        </div>
      </div>
    </main>
  );
}

function ProfileField({
  icon,
  label,
  value,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "size-6 rounded-md flex items-center justify-center shrink-0 " +
          (value
            ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
            : "bg-slate-100 text-slate-400 dark:bg-slate-800")
        }
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</div>
        <div
          className={
            "text-xs font-medium truncate " +
            (value ? "text-foreground" : "text-muted-foreground italic")
          }
        >
          {value || placeholder}
        </div>
      </div>
      {value && (
        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
      )}
    </div>
  );
}
