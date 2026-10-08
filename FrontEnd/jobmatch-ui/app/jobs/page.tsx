"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api, getToken, streamChat, type MatchRow } from "@/lib/api";
import {
  Bot,
  Building2,
  FileText,
  MapPin,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

const LEVEL_FA: Record<string, string> = {
  intern: "کارآموز",
  junior: "جونیور",
  mid: "میان‌رده",
  senior: "ارشد",
};

function scoreColor(s: number) {
  if (s >= 70) return "bg-emerald-500";
  if (s >= 45) return "bg-amber-500";
  return "bg-rose-500";
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function JobsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<MatchRow | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  // chat panel
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "سلام! می‌تونم آگهی‌ها رو برات غربال کنم، دلیل تناسب یک آگهی رو توضیح بدم، یا رزومه‌ات رو بسازم. چه کمکی می‌خوای؟",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ count: number; results: MatchRow[] }>(
        "/jobs/feed/?limit=20",
      );
      setRows(data.results);
    } catch {
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    loadFeed();
  }, [loadFeed, router]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendFeedback(row: MatchRow, relevant: boolean) {
    await api("/jobs/" + row.job.id + "/feedback/", {
      method: "POST",
      body: JSON.stringify({ relevant, reason: feedbackText }),
    }).catch(() => {});
    setFeedbackFor(null);
    setFeedbackText("");
    loadFeed();
  }

  async function scrape() {
    setScraping(true);
    setNote("");
    try {
      const data = await api<{ note: string; created_count: number }>(
        "/jobs/scrape/",
        { method: "POST" },
      );
      setNote(data.note + " — " + data.created_count + " آگهی جدید");
      loadFeed();
    } finally {
      setScraping(false);
    }
  }

  async function sendChat(message?: string) {
    const text = (message ?? chatInput).trim();
    if (!text || chatBusy) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setChatInput("");
    setChatBusy(true);
    try {
      await streamChat(text, "jobs", (event) => {
        if (event.type === "assistant" && event.text) {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: event.text! },
          ]);
        }
      });
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "خطا در ارتباط با ایجنت." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <main className="flex-1 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">فرصت‌های مناسب شما</h1>
              <p className="text-xs text-muted-foreground">
                مرتب‌شده بر اساس تناسب با پروفایل‌ات
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={(e) => router.push("/resume")}>
              <FileText className="size-4" />
              استودیوی رزومه
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAuth();
                router.push("/");
              }}
            >
              خروج
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          {note ? (
            <Badge variant="success" className="max-w-md truncate">
              {note}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">
              {loading ? "در حال محاسبه…" : rows.length + " آگهی فعال"}
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={scrape} disabled={scraping}>
            <Search className="size-4" />
            {scraping ? "در حال جست‌وجوی منابع…" : "جست‌وجوی منابع جدید"}
          </Button>
        </div>

        {/* feed */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 space-y-3">
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/3 bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <Card key={row.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-bold leading-snug">{row.job.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3.5" />
                          {row.job.company}
                        </span>
                        {row.job.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {row.job.city}
                          </span>
                        ) : null}
                        {row.job.level ? (
                          <Badge variant="secondary">{LEVEL_FA[row.job.level] || row.job.level}</Badge>
                        ) : null}
                        {row.job.job_types.includes("remote") ? (
                          <Badge variant="success">دورکاری</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-center">
                      <div
                        className={
                          "size-12 rounded-full text-white flex items-center justify-center font-bold text-sm " +
                          scoreColor(row.score)
                        }
                      >
                        {row.score}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        از ۱۰۰
                      </div>
                    </div>
                  </div>

                  <Progress value={row.score} className="h-1.5 progress-rtl" />

                  {row.reasons?.length ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      • {row.reasons[0]}
                    </p>
                  ) : null}

                  {row.missing_skills?.length ? (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[11px] text-muted-foreground">جاافتاده:</span>
                      {row.missing_skills.slice(0, 3).map((s) => (
                        <Badge key={s} variant="warning" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      چرا این آگهی؟
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFeedbackFor(row)}>
                      بازخورد
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* floating chat */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-40 size-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
        aria-label="چت با ایجنت"
      >
        {chatOpen ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>

      {chatOpen ? (
        <div className="fixed bottom-24 left-5 z-40 w-[92vw] max-w-sm">
          <Card className="shadow-2xl">
            <CardContent className="p-0">
              <div className="bg-indigo-600 text-white px-4 py-3 rounded-t-xl">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Bot className="size-4" />
                  همراه کاریابی
                </div>
              </div>
              <div className="max-h-[45vh] overflow-y-auto p-3 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={"flex " + (m.role === "user" ? "justify-start" : "justify-end")}>
                    <div
                      className={
                        "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed " +
                        (m.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-muted rounded-bl-sm")
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatBusy ? (
                  <div className="flex justify-end">
                    <div className="bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground">
                      …
                    </div>
                  </div>
                ) : null}
                <div ref={chatBottom} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
                className="flex gap-2 border-t p-3"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="سؤال یا درخواست…"
                  className="h-9 text-xs"
                />
                <Button size="icon" className="size-9" disabled={chatBusy}>
                  <Send className="size-4 rotate-180" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Why dialog */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-background rounded-xl border w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{selected.job.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {selected.job.company} — {selected.job.city}
                </p>
              </div>
              <div className={"size-11 rounded-full text-white flex items-center justify-center font-bold " + scoreColor(selected.score)}>
                {selected.score}
              </div>
            </div>

            <div className="space-y-1.5">
              {[
                ["مهارت‌ها", selected.breakdown?.skills, 45],
                ["عنوان/نقش", selected.breakdown?.role, 25],
                ["سطح", selected.breakdown?.level, 20],
                ["شرایط کاری", selected.breakdown?.logistics, 10],
              ].map(([label, value, max]) => (
                <div key={String(label)} className="flex items-center gap-3">
                  <span className="text-xs w-20 shrink-0 text-muted-foreground">{label}</span>
                  <Progress value={((Number(value) || 0) / Number(max)) * 100} className="h-2 flex-1 progress-rtl" />
                  <span className="text-xs w-12 text-left font-medium">
                    {Number(value) || 0}/{Number(max)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">دلایل:</div>
              <ul className="space-y-1">
                {(selected.reasons || []).map((r, i) => (
                  <li key={i} className="text-xs flex gap-2">
                    <span className={r.includes("نیست") || r.includes("خوان نیست") ? "text-rose-500" : "text-emerald-600"}>
                      {r.includes("نیست") || r.includes("خوان نیست") ? "✕" : "✓"}
                    </span>
                    <span className="text-foreground/90">{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {selected.job.description ? (
              <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed">
                {selected.job.description}
              </div>
            ) : null}

            {selected.missing_skills?.length ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  مهارت‌هایی که اضافه کنی:
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.missing_skills.map((s) => (
                    <Badge key={s} variant="warning">{s}</Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setChatOpen(true);
                  setMessages((m) => [...m, { role: "user", content: "چرا آگهی «" + selected.job.title + "» برای من مناسبه یا نه؟" }]);
                  setChatBusy(true);
                  streamChat("آگهی «" + selected.job.title + "» در شرکت " + selected.job.company + " — لطفاً دلایل تناسب یا عدم تناسبش رو با جزئیات برایم توضیح بده.", "explain", (ev) => {
                    if (ev.type === "assistant" && ev.text) {
                      setMessages((m) => [...m, { role: "assistant", content: ev.text! }]);
                      setChatBusy(false);
                    }
                  }).catch(() => setChatBusy(false));
                  setSelected(null);
                }}
              >
                <Bot className="size-4" />
                توضیح ایجنت
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                بستن
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Feedback dialog */}
      {feedbackFor ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setFeedbackFor(null)}
        >
          <div
            className="bg-background rounded-xl border w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold">بازخورد شما</h3>
            <p className="text-sm text-muted-foreground">
              «{feedbackFor.job.title}» چطور بود؟ با بازخورد شما، پیشنهادهای بعدی
              دقیق‌تر می‌شوند.
            </p>
            <Input
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="مثلاً: حوزه‌اش به کار من ربطی ندارد"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setFeedbackFor(null)}>
                انصراف
              </Button>
              <Button variant="secondary" size="sm" onClick={() => sendFeedback(feedbackFor, true)}>
                <ThumbsUp className="size-4" />
                مرتبط بود
              </Button>
              <Button variant="destructive" size="sm" onClick={() => sendFeedback(feedbackFor, false)}>
                <ThumbsDown className="size-4" />
                نامرتبط بود
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function clearAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("jm_access");
  }
}
