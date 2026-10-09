
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RetroWindow, RetroButton, RetroCard } from "@/components/retro";
import { register, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        try {
          await register(username, password, email || undefined);
        } catch (err) {
          throw new Error(
            err instanceof Error
              ? err.message
              : "ثبت‌نام انجام نشد. اطلاعات را بررسی کن."
          );
        }
      }

      const data = await login(username, password);
      router.replace(data.profile_completed ? "/jobs" : "/onboarding");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ارتباط با سرور برقرار نشد. مطمئن شو بک‌اند اجراست."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[var(--bg-primary)] p-4 flex items-center justify-center"
    >
      <div className="w-full max-w-md">
        <RetroWindow title="🔐 همراه.exe | حساب کاربری" className="w-full">
          <div className="space-y-5">
            <header className="text-center">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {mode === "login" ? "خوش برگشتی!" : "به همراه بپیوند"}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {mode === "login"
                  ? "برای ادامه وارد حساب خودت شو."
                  : "حساب بساز و مسیر شغلی‌ات را شروع کن."}
              </p>
            </header>

            <div className="grid grid-cols-2 gap-2">
              <RetroButton
                variant={mode === "login" ? "primary" : undefined}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                ورود
              </RetroButton>

              <RetroButton
                variant={mode === "register" ? "primary" : undefined}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                ثبت‌نام
              </RetroButton>
            </div>

            <RetroCard variant="solid">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="username"
                    className="mb-1 block text-sm text-[var(--text-primary)]"
                  >
                    نام کاربری
                  </label>
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]"
                    placeholder="نام کاربری خودت را وارد کن"
                  />
                </div>

                {mode === "register" && (
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1 block text-sm text-[var(--text-primary)]"
                    >
                      ایمیل (اختیاری)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]"
                      placeholder="name@example.com"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm text-[var(--text-primary)]"
                  >
                    رمز عبور
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "register" ? 4 : undefined}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]"
                    placeholder="رمز عبور"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded border border-red-500 p-3 text-sm text-red-600"
                  >
                    {error}
                  </p>
                )}

                <RetroButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading
                    ? "لطفاً صبر کن..."
                    : mode === "login"
                      ? "ورود به حساب"
                      : "ساخت حساب و ورود"}
                </RetroButton>
              </form>
            </RetroCard>

            <div className="text-center">
              <Link
                href="/"
                className="text-sm text-[var(--text-secondary)] underline"
              >
                بازگشت به صفحهٔ اصلی
              </Link>
            </div>
          </div>
        </RetroWindow>
      </div>
    </main>
  );
}

