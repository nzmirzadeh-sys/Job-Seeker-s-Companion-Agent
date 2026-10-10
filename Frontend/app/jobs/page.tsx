"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  api,
  getToken,
  sendJobFeedback,
  streamChat,
  type MatchRow,
} from "@/lib/api";
import JobsSidebar from "@/components/jobs/JobsSidebar";
import MatchScoreBadge from "@/components/jobs/MatchScoreBadge";
import BreakdownBars from "@/components/jobs/BreakdownBars";
import JobMetaChips from "@/components/jobs/JobMetaChips";
import SkillChips from "@/components/jobs/SkillChips";
import { jobsTheme } from "@/components/jobs/theme";
import {
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function JobsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | number | null>(
    null,
  );

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
    setLoadError(null);

    try {
      const data = await api<{ count: number; results: MatchRow[] }>(
        "/jobs/feed/?limit=20",
      );

      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      console.error("خطا در بارگذاری آگهی‌ها:", error);

      setLoadError(
        error instanceof Error ? error.message : "دریافت آگهی‌ها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    void loadFeed();
  }, [loadFeed, router]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFeedback(
    event: MouseEvent,
    row: MatchRow,
    relevant: boolean,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setFeedbackBusyId(row.job.id);

    try {
      await sendJobFeedback(row.job.id, relevant);
      setRows((current) => current.filter((item) => item.job.id !== row.job.id));
    } catch (error) {
      console.error("خطا در ثبت بازخورد آگهی:", error);
    } finally {
      setFeedbackBusyId(null);
    }
  }

  async function sendChat(message?: string) {
    const text = (message ?? chatInput).trim();

    if (!text || chatBusy) return;

    setMessages((current) => [...current, { role: "user", content: text }]);
    setChatInput("");
    setChatBusy(true);

    let receivedAssistantMessage = false;

    try {
      await streamChat(text, "jobs", (event) => {
        if (event.type === "assistant" && event.text) {
          receivedAssistantMessage = true;

          setMessages((current) => [
            ...current,
            { role: "assistant", content: event.text! },
          ]);
        }
      });

      if (!receivedAssistantMessage) {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "پاسخی از ایجنت دریافت نشد." },
        ]);
      }
    } catch (error) {
      console.error("خطا در ارتباط با ایجنت:", error);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "خطا در ارتباط با ایجنت. اتصال سرور را بررسی کن.",
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const query = searchText.trim().toLocaleLowerCase();

    if (!query) return true;

    return [row.job.title, row.job.company, row.job.city].some((value) =>
      value?.toLocaleLowerCase().includes(query),
    );
  });

  return (
    <main
      className="flex min-h-screen gap-4 p-4 md:p-6"
      style={{ background: jobsTheme.pageBg, color: jobsTheme.text }}
    >
      <JobsSidebar />

      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">فرصت‌های شغلی</h1>
            <p className="mt-1 text-sm" style={{ color: jobsTheme.textMuted }}>
              {rows.length} آگهی — مرتب‌شده بر اساس تناسب با پروفایل‌ات
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadFeed()}
            disabled={loading}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition-opacity disabled:opacity-60"
            style={{
              backgroundColor: jobsTheme.card,
              border: `1px solid ${jobsTheme.cardBorder}`,
              color: jobsTheme.primaryDark,
            }}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            به‌روزرسانی
          </button>
        </div>

        {/* Search */}
        <form
          className="mb-5 flex gap-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: jobsTheme.textFaint }}
            />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="جستجو در عنوان، شرکت یا شهر…"
              aria-label="جستجوی آگهی‌ها"
              className="h-11 rounded-2xl border-none pr-10 text-sm shadow-sm"
              style={{ backgroundColor: jobsTheme.card, color: jobsTheme.text }}
            />
          </div>
        </form>

        {/* Job list */}
        <div className="space-y-3 pb-24">
          {loading ? (
            <div
              className="rounded-3xl p-10 text-center text-sm"
              style={{ backgroundColor: jobsTheme.card, color: jobsTheme.textMuted }}
            >
              در حال بارگذاری آگهی‌ها…
            </div>
          ) : loadError ? (
            <div
              className="space-y-3 rounded-3xl p-8 text-center"
              style={{ backgroundColor: jobsTheme.card }}
            >
              <p className="text-sm font-bold" style={{ color: jobsTheme.danger }}>
                بارگذاری آگهی‌ها ناموفق بود.
              </p>
              <p className="break-words text-xs" style={{ color: jobsTheme.textMuted }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadFeed()}
                className="rounded-full px-5 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: jobsTheme.primary }}
              >
                تلاش دوباره
              </button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div
              className="rounded-3xl p-10 text-center text-sm"
              style={{ backgroundColor: jobsTheme.card, color: jobsTheme.textMuted }}
            >
              {rows.length === 0
                ? "هنوز آگهی موجود نیست."
                : "آگهی‌ای با این عبارت پیدا نشد."}
            </div>
          ) : (
            filteredRows.map((row) => {
              const requiredMissing = row.missing_skills ?? [];
              const matchedSkills = (row.job.required_skills ?? []).filter(
                (skill) => !requiredMissing.includes(skill),
              );

              return (
                <button
                  key={row.job.id}
                  type="button"
                  onClick={() => router.push(`/jobs/${row.job.id}`)}
                  className="group block w-full rounded-3xl p-4 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-5"
                  style={{
                    backgroundColor: jobsTheme.card,
                    border: `1px solid ${jobsTheme.cardBorder}`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <MatchScoreBadge score={row.score} size="md" />

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-base font-extrabold">{row.job.title}</h2>
                          <p className="text-xs" style={{ color: jobsTheme.textMuted }}>
                            {row.job.company}
                          </p>
                        </div>
                      </div>

                      <JobMetaChips job={row.job} size="sm" />

                      {(matchedSkills.length > 0 || requiredMissing.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          <SkillChips skills={matchedSkills} tone="success" />
                          <SkillChips skills={requiredMissing} tone="danger" />
                        </div>
                      )}

                      {row.breakdown && (
                        <div className="pt-1">
                          <BreakdownBars breakdown={row.breakdown} />
                        </div>
                      )}

                      {requiredMissing.length > 0 && (
                        <p className="text-[11px]" style={{ color: jobsTheme.danger }}>
                          این مهارت‌ها الزامی است و در پروفایل شما نیست:{" "}
                          {requiredMissing.join("، ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-end gap-2 border-t pt-3"
                    style={{ borderColor: jobsTheme.cardBorder }}
                  >
                    <span
                      className="ml-auto text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: jobsTheme.primaryDark }}
                    >
                      مشاهده‌ی تحلیل کامل ←
                    </span>

                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="رد کن"
                      onClick={(event) => void handleFeedback(event, row, false)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity disabled:opacity-50"
                      style={{
                        backgroundColor: jobsTheme.dangerSoft,
                        color: jobsTheme.danger,
                        opacity: feedbackBusyId === row.job.id ? 0.5 : 1,
                      }}
                    >
                      <ThumbsDown className="size-3.5" />
                      رد کن
                    </span>

                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="ذخیره کن"
                      onClick={(event) => void handleFeedback(event, row, true)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity disabled:opacity-50"
                      style={{
                        backgroundColor: jobsTheme.successSoft,
                        color: jobsTheme.success,
                        opacity: feedbackBusyId === row.job.id ? 0.5 : 1,
                      }}
                    >
                      <ThumbsUp className="size-3.5" />
                      ذخیره کن
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* AI Chat */}
      <div className="fixed bottom-6 left-6 z-50">
        {!chatOpen ? (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${jobsTheme.primary}, ${jobsTheme.primaryDark})`,
            }}
          >
            <MessageCircle className="size-4" />
            دستیار هوشمند
          </button>
        ) : (
          <section
            className="flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl shadow-2xl"
            style={{ backgroundColor: jobsTheme.card }}
            aria-label="گفت‌وگو با دستیار هوشمند"
          >
            <header
              className="flex items-center justify-between gap-2 px-4 py-3 text-white"
              style={{
                background: `linear-gradient(135deg, ${jobsTheme.primary}, ${jobsTheme.primaryDark})`,
              }}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4" />
                دستیار هوشمند کاروویا
              </div>

              <button
                type="button"
                aria-label="بستن دستیار"
                onClick={() => setChatOpen(false)}
                className="flex size-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-xs ${
                    message.role === "user" ? "mr-auto" : "ml-auto"
                  }`}
                  style={{
                    backgroundColor:
                      message.role === "user"
                        ? jobsTheme.primarySoft
                        : jobsTheme.primarySofter,
                    color: jobsTheme.text,
                  }}
                >
                  {message.content}
                </div>
              ))}

              {chatBusy && (
                <p className="text-xs" style={{ color: jobsTheme.textMuted }}>
                  دستیار در حال پاسخ‌گویی است…
                </p>
              )}

              <div ref={chatBottom} />
            </div>

            <form
              className="flex gap-2 border-t p-3"
              style={{ borderColor: jobsTheme.cardBorder }}
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat();
              }}
            >
              <Input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="پیامت را بنویس…"
                aria-label="پیام به دستیار"
                disabled={chatBusy}
                className="h-9 min-w-0 rounded-full text-xs"
                style={{ backgroundColor: jobsTheme.primarySofter }}
              />

              <button
                type="submit"
                aria-label="ارسال پیام"
                disabled={chatBusy || !chatInput.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
                style={{ backgroundColor: jobsTheme.primary }}
              >
                <Send className="size-4" />
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
