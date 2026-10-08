"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register, getToken, api } from "@/lib/api";
import { Compass, Bot, Sparkles, FileText, SearchCheck } from "lucide-react";
import { toast } from "sonner";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        await register(username, password);
        toast.success("حساب کاربری با موفقیت ساخته شد! اکنون با همین اطلاعات وارد شوید.");
        setMode("login");
        setPassword("");
        return;
      }

      // login mode
      const data = await login(username, password);
      let completed = data.profile_completed;

      if (!completed) {
        try {
          const profile = await api<{ completed: boolean }>("/accounts/profile/");
          completed = profile.completed;
        } catch {}
      }

      toast.success("خوش آمدید!");
      router.push(completed ? "/jobs" : "/onboarding");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unauthorized") || msg.includes("401")) {
        toast.error("نام کاربری یا رمز عبور اشتباه است.");
      } else if (msg.includes("username") && msg.includes("exist")) {
        toast.error("این نام کاربری قبلاً ثبت شده است.");
      } else if (msg.includes("password")) {
        toast.error("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      } else {
        toast.error("خطا در ارتباط با سرور. دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  }

  const alreadyIn = typeof window !== "undefined" && !!getToken();

  return (
    <main className="flex-1 min-h-screen bg-gradient-to-b from-indigo-50 via-background to-indigo-100 dark:from-slate-950 dark:via-background dark:to-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 items-center">
          {/* Pitch */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-4 py-1.5 text-sm text-indigo-700 dark:border-indigo-800 dark:text-indigo-300">
              <Sparkles className="size-4" />
              همراه کاریابی — ایجنت هوشمند جست‌وجوی کار
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
              از سردرگمی بین آگهی‌ها تا{" "}
              <span className="text-indigo-600 dark:text-indigo-400">
                درخواست آماده
              </span>
              ، قدم‌به‌قدم همراهتیم
            </h1>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2 items-start">
                <SearchCheck className="mt-1 size-5 text-indigo-500 shrink-0" />
                <span>
                  آگهی‌های نامرتبط حذف می‌شوند؛ فقط فرصت‌های واقعاً مناسب با
                  <b className="text-foreground"> دلیل تناسب</b> پیشنهاد می‌شوند.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <FileText className="mt-1 size-5 text-indigo-500 shrink-0" />
                <span>
                  ایجنت از شما سؤال می‌پرسد و
                  <b className="text-foreground"> رزومهٔ استاندارد + PDF</b>{" "}
                  می‌سازد.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <Sparkles className="mt-1 size-5 text-indigo-500 shrink-0" />
                <span>
                  <b className="text-foreground">تحلیل و راستی‌آزمایی شواهد آگهی</b>: استخراج ساختاریافته مهارت‌های الزامی، امتیازی و پشته فنی با استناد مستقیم به متن آگهی.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <Bot className="mt-1 size-5 text-indigo-500 shrink-0" />
                <span>
                  با بازخورد شما، جست‌وجو و رزومه{" "}
                  <b className="text-foreground">هر بار بهتر</b> می‌شود.
                </span>
              </li>
            </ul>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => router.push("/analyzer")}
                className="w-full sm:w-auto border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-xs"
              >
                <Sparkles className="size-4 ml-2 text-indigo-500" />
                آزمایش ایجنت: تحلیل هوشمند یک آگهی شغلی
              </Button>
            </div>
          </div>

          {/* Auth card */}
          <Card className="shadow-xl border-indigo-100 dark:border-slate-700">
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="flex items-center gap-3 justify-center">
                <div className="size-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <Compass className="size-6" />
                </div>
                <div>
                  <div className="font-bold text-lg">همراه کاریابی</div>
                  <div className="text-xs text-muted-foreground">
                    JobMatch AI
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={
                    "rounded-md py-2 text-sm font-medium transition-colors " +
                    (mode === "login"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground")
                  }
                >
                  ورود
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={
                    "rounded-md py-2 text-sm font-medium transition-colors " +
                    (mode === "register"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground")
                  }
                >
                  ثبت‌نام
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">نام کاربری</Label>
                  <Input
                    id="username"
                    dir="ltr"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">رمز عبور</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "register" ? 8 : 1}
                  />
                  {mode === "register" && (
                    <p className="text-xs text-muted-foreground">حداقل ۸ کاراکتر</p>
                  )}
                </div>
                <Button className="w-full" disabled={loading}>
                  {loading
                    ? "لطفاً صبر کنید…"
                    : mode === "login"
                      ? "ورود به حساب"
                      : "ساخت حساب جدید"}
                </Button>
              </form>

              {alreadyIn ? (
                <button
                  onClick={() => router.push("/jobs")}
                  className="w-full text-center text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  قبلاً وارد شده‌اید — رفتن به داشبورد
                </button>
              ) : (
                <p className="text-center text-xs text-muted-foreground" dir="ltr">
                  demo / demo1234
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
