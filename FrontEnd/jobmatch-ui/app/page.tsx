"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register, getToken, api } from "@/lib/api";
import { Compass, Bot, Sparkles, FileText, SearchCheck } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let completed = false;
      if (mode === "login") {
        const data = await login(username, password);
        completed = data.profile_completed;
      } else {
        await register(username, password);
        await login(username, password);
        completed = false;
      }
      if (completed) {
        router.push("/jobs");
      } else {
        // still confirm active profile state from server
        try {
          const profile = await api<{ completed: boolean }>("/accounts/profile/");
          completed = profile.completed;
        } catch {}
        router.push(completed ? "/jobs" : "/onboarding");
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
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
                <Bot className="mt-1 size-5 text-indigo-500 shrink-0" />
                <span>
                  با بازخورد شما، جست‌وجو و رزومه{" "}
                  <b className="text-foreground">هر بار بهتر</b> می‌شود.
                </span>
              </li>
            </ul>
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
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive" dir="auto">
                    {error}
                  </p>
                ) : null}
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
