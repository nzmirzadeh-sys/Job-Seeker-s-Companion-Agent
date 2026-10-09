"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { streamChat, api, type Profile } from "@/lib/api";
import { CheckCircle2, Compass, Send } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "سلام! 👋 من همراه کاریابی تو هستم. بگو چه نقشی می‌خوای، چه مهارت‌هایی داری، کجای ایران هستی و چند سال تجربه داری — من پروفایلت رو کامل می‌کنم و بهترین آگهی‌ها رو برات می‌سازم.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  api<Profile>("/accounts/profile/")
    .then(setProfile)
    .catch((error) => {
      console.error("خطا در دریافت پروفایل:", error);
    });
}, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);

try {
  await streamChat(message, "onboarding", (event) => {
    if (event.type === "assistant" && event.text) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: event.text! },
      ]);
    }
  });

  // دریافت دوباره وضعیت پروفایل از بک‌اند
  api<Profile>("/accounts/profile/")
    .then(setProfile)
    .catch(() => {});
} catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "خطا در ارتباط با سرور. دوباره تلاش کن." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    "فرانت‌اند جونیور هستم، بلدم HTML/CSS/JavaScript و کمی React، تو تهران زندگی می‌کنم",
    "کارآموز می‌خوام، تازه HTML و CSS یاد گرفتم",
    "می‌خوام فقط دورکاری کار کنم و نقشم ری‌اکت‌کار باشه",
  ];

  return (
    <main className="flex-1 min-h-screen bg-gradient-to-b from-indigo-50 to-background dark:from-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Compass className="size-5" />
            </div>
            <h1 className="text-lg font-bold">ساخت پروفایل هنرجویی</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/jobs")}
            disabled={!profile?.completed}
          >
            {profile?.completed ? "رفتن به آگهی‌ها" : "پروفایل ناقص است"}
          </Button>
        </div>

        {profile?.completed ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-4" />
            پروفایلت کامل شد! می‌توانی مستقیم بروی سراغ آگهی‌های امتیازدار.
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <div className="max-h-[55vh] min-h-[320px] overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    "flex " +
                    (m.role === "user" ? "justify-start" : "justify-end")
                  }
                >
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                      (m.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-muted rounded-bl-sm")
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="flex justify-end">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-muted-foreground">
                    در حال نوشتن…
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {quick.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={busy}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  >
                    {q.slice(0, 38)}…
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="مثلاً: ۲ سال تجربه Vue دارم، اصفهان هستم…"
                />
                <Button type="submit" size="icon" disabled={busy}>
                  <Send className="size-4 rotate-180" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
