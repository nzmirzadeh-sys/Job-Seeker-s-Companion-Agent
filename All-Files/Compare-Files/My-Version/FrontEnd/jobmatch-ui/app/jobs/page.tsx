
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  api,
  getToken,
  streamChat,
  type MatchDecisionResult,
  type MatchRow,
} from "@/lib/api";
import RetroWindow from "@/components/retro/RetroWindow";
import { Search, Sparkles } from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function JobsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [decisionFor, setDecisionFor] = useState<MatchRow | null>(null);
  const [decisionResult, setDecisionResult] =
    useState<MatchDecisionResult | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");

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
        error instanceof Error
          ? error.message
          : "دریافت آگهی‌ها ناموفق بود.",
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

  async function analyzeDecision(row: MatchRow) {
    setDecisionFor(row);
    setDecisionResult(null);
    setDecisionError(null);
    setDecisionLoading(true);

    try {
      const data = await api<{ match_result: MatchDecisionResult }>(
        "/match/analyze/",
        {
          method: "POST",
          body: JSON.stringify({
            job_id: row.job.id,
            explain_with_llm: true,
          }),
        },
      );

      setDecisionResult(data.match_result);
    } catch (error) {
      console.error("خطا در تحلیل تناسب آگهی:", error);

      setDecisionError(
        error instanceof Error
          ? error.message
          : "تحلیل آگهی ناموفق بود.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  function decisionLabel(value: string) {
    const labels: Record<string, string> = {
      strong_match: "تناسب قوی",
      good_match: "تناسب خوب",
      partial_match: "تناسب نسبی",
      weak_match: "تناسب ضعیف",
      not_recommended: "توصیه نمی‌شود",
      needs_more_information: "نیازمند اطلاعات بیشتر",
    };

    return labels[value] || value;
  }

  function statusIcon(status: string) {
    if (status === "match") return "✓";
    if (status === "conflict") return "✕";
    return "!";
  }

  async function sendChat(message?: string) {
    const text = (message ?? chatInput).trim();

    if (!text || chatBusy) return;

    setMessages((current) => [
      ...current,
      { role: "user", content: text },
    ]);
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
          {
            role: "assistant",
            content: "پاسخی از ایجنت دریافت نشد.",
          },
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

    return [
      row.job.title,
      row.job.company,
      row.job.city,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });

  return (
    <main
      className="flex-1 min-h-screen p-4"
      style={{ backgroundColor: "#FBF7EC", color: "#141311" }}
    >
      <div className="mx-auto max-w-7xl">
        <RetroWindow
          title="HAMRAH.EXE - فرصت‌های شغلی"
          menu={[
            { title: "File" },
            { title: "Edit" },
            { title: "Format" },
            { title: "View" },
            { title: "Help" },
          ]}
          className="min-h-screen"
          contentClassName="flex flex-col gap-2 md:flex-row"
        >
          {/* Left Panel - Job Feed */}
          <div
            className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden border-b-2 pb-2 md:border-b-0 md:border-r-2 md:pb-0 md:pr-2"
            style={{ borderColor: "#141311" }}
          >
            <div className="shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5" style={{ color: "#F2C230" }} />
                <h2 className="font-bold text-sm">فرصت‌های مناسب شما</h2>
              </div>

              <p className="text-xs" style={{ color: "#5A5450" }}>
                مرتب‌شده بر اساس تناسب با پروفایل‌ات
              </p>
            </div>

            {/* Search */}
            <form
              className="flex shrink-0 gap-1"
              onSubmit={(event) => event.preventDefault()}
            >
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="جستجو در عنوان، شرکت یا شهر…"
                aria-label="جستجوی آگهی‌ها"
                className="h-8 text-xs"
                style={{
                  backgroundColor: "#FBF7EC",
                  borderColor: "#141311",
                  color: "#141311",
                }}
              />

              <Button
                type="submit"
                size="icon"
                className="size-8 shrink-0"
                aria-label="جستجو"
                style={{
                  backgroundColor: "#F2C230",
                  color: "#141311",
                }}
              >
                <Search className="size-3" />
              </Button>
            </form>

            {/* Job List */}
            <div
              className="min-h-48 flex-1 space-y-1 overflow-y-auto border-t-2 pt-2"
              style={{ borderTopColor: "#141311" }}
            >
              {loading ? (
                <div
                  className="py-4 text-center text-xs"
                  style={{ color: "#5A5450" }}
                >
                  در حال بارگذاری آگهی‌ها…
                </div>
              ) : loadError ? (
                <div
                  className="space-y-2 p-3 text-center text-xs"
                  style={{ color: "#B23A2E" }}
                >
                  <p>بارگذاری آگهی‌ها ناموفق بود.</p>
                  <p className="break-words">{loadError}</p>
                  <Button
                    size="sm"
                    onClick={() => void loadFeed()}
                    style={{
                      backgroundColor: "#F2C230",
                      color: "#141311",
                    }}
                  >
                    تلاش دوباره
                  </Button>
                </div>
              ) : filteredRows.length === 0 ? (
                <div
                  className="py-4 text-center text-xs"
                  style={{ color: "#5A5450" }}
                >
                  {rows.length === 0
                    ? "هنوز آگهی موجود نیست."
                    : "آگهی‌ای با این عبارت پیدا نشد."}
                </div>
              ) : (
                filteredRows.map((row) => (
                  <button
                    key={row.job.id}
                    type="button"
                    className={`w-full cursor-pointer border-2 p-2 text-left text-xs ${
                      selected?.job.id === row.job.id
                        ? "border-[#F2C230]"
                        : "border-[#141311]"
                    }`}
                    onClick={() => {
                      setSelected(row);
                      setDecisionFor(null);
                      setDecisionResult(null);
                      setDecisionError(null);
                    }}
                    style={{
                      backgroundColor:
                        selected?.job.id === row.job.id
                          ? "#FCE9A8"
                          : "transparent",
                      color: "#141311",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">{row.job.title}</div>
                        <div
                          className="mt-1 break-words"
                          style={{ color: "#5A5450" }}
                        >
                          {row.job.company} • {row.job.city}
                        </div>
                      </div>

                      <div
                        className="flex size-8 shrink-0 items-center justify-center border-2 font-bold"
                        style={{
                          backgroundColor:
                            row.score >= 70
                              ? "#3B7A4A"
                              : row.score >= 45
                                ? "#C98A1F"
                                : "#B23A2E",
                          borderColor: "#141311",
                          color: "#FBF7EC",
                        }}
                      >
                        {row.score}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Job Details / Decision */}
          {selected && (
            <div
              className="flex w-full min-w-0 flex-col gap-2 overflow-hidden border-t-2 pt-2 md:w-96 md:shrink-0 md:border-l-2 md:border-t-0 md:pl-2 md:pt-0"
              style={{ borderColor: "#141311" }}
            >
              {decisionFor?.job.id === selected.job.id &&
              decisionResult ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{selected.job.title}</h3>

                    <div className="shrink-0 text-center">
                      <div
                        className="mx-auto flex size-12 items-center justify-center border-4 font-bold"
                        style={{
                          backgroundColor:
                            decisionResult.overall_score >= 70
                              ? "#3B7A4A"
                              : decisionResult.overall_score >= 45
                                ? "#C98A1F"
                                : "#B23A2E",
                          borderColor: "#141311",
                          color: "#FBF7EC",
                        }}
                      >
                        {decisionResult.overall_score}٪
                      </div>

                      <div className="mt-1 text-[10px]">
                        {decisionLabel(decisionResult.overall_decision)}
                      </div>
                    </div>
                  </div>

                  <Separator style={{ backgroundColor: "#141311" }} />

                  {/* Fit Dimensions */}
                  <div className="space-y-1">
                    <div className="font-bold">ابعاد تناسب:</div>

                    {(
                      [
                        ["تکنیکی", decisionResult.technical_fit],
                        ["سابقه", decisionResult.experience_fit],
                        ["تحصیلات", decisionResult.education_fit],
                      ] as [
                        string,
                        MatchDecisionResult["technical_fit"],
                      ][]
                    ).map(([label, dimension]) => (
                      <div
                        key={label}
                        className="border-2 p-1"
                        style={{
                          backgroundColor:
                            dimension.status === "match"
                              ? "#FCE9A8"
                              : "transparent",
                          borderColor: "#141311",
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="flex size-4 items-center justify-center text-[9px] font-bold"
                            style={{
                              backgroundColor:
                                dimension.status === "match"
                                  ? "#3B7A4A"
                                  : dimension.status === "conflict"
                                    ? "#B23A2E"
                                    : "#C98A1F",
                              color: "#FBF7EC",
                            }}
                          >
                            {statusIcon(dimension.status)}
                          </span>

                          <span className="font-bold">{label}</span>

                          <span className="mr-auto text-[10px]">
                            {dimension.score}/{dimension.max_score}
                          </span>
                        </div>

                        <div className="mt-1 text-[10px]">
                          {dimension.explanation}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Matching Skills */}
                  {decisionResult.matching_skills.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold">
                        مهارت‌های تأییدشده:
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {decisionResult.matching_skills.map((skill) => (
                          <Badge
                            key={skill}
                            className="text-[9px]"
                            style={{
                              backgroundColor: "#3B7A4A",
                              color: "#FBF7EC",
                            }}
                          >
                            ✓ {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Required Skills */}
                  {decisionResult.missing_required_skills.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold">
                        مهارت‌های الزامی بدون شواهد:
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {decisionResult.missing_required_skills.map(
                          (skill) => (
                            <Badge
                              key={skill}
                              className="text-[9px]"
                              style={{
                                backgroundColor: "#B23A2E",
                                color: "#FBF7EC",
                              }}
                            >
                              ✕ {skill}
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{selected.job.title}</h3>

                    <div
                      className="flex size-8 shrink-0 items-center justify-center border-2 font-bold"
                      style={{ borderColor: "#141311" }}
                    >
                      {selected.score}
                    </div>
                  </div>

                  <div style={{ color: "#5A5450" }}>
                    {selected.job.company} • {selected.job.city}
                  </div>

                  {selected.breakdown && (
                    <div
                      className="space-y-1 border-t-2 pt-2"
                      style={{ borderTopColor: "#141311" }}
                    >
                      <div className="font-bold">تفکیک امتیاز:</div>

                      {(
                        [
                          ["مهارت‌ها", selected.breakdown.skills, 45],
                          ["نقش", selected.breakdown.role, 25],
                          ["سطح", selected.breakdown.level, 20],
                          ["شرایط", selected.breakdown.logistics, 10],
                        ] as [string, number, number][]
                      ).map(([label, value, max]) => (
                        <div
                          key={label}
                          className="flex items-center gap-1"
                        >
                          <span className="w-16 text-[10px]">{label}</span>

                          <Progress
                            value={(value / max) * 100}
                            className="h-1 flex-1"
                          />

                          <span className="w-10 text-right text-[10px]">
                            {value}/{max}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selected.reasons && selected.reasons.length > 0 && (
                    <div
                      className="space-y-1 border-t-2 pt-2"
                      style={{ borderTopColor: "#141311" }}
                    >
                      <div className="font-bold">دلایل:</div>

                      <ul className="space-y-0.5">
                        {selected.reasons.map((reason, index) => {
                          const negative =
                            reason.includes("نیست") ||
                            reason.includes("خوان نیست");

                          return (
                            <li
                              key={index}
                              className="flex gap-1 text-[10px]"
                            >
                              <span
                                className="font-bold"
                                style={{
                                  color: negative ? "#B23A2E" : "#3B7A4A",
                                }}
                              >
                                {negative ? "✕" : "✓"}
                              </span>

                              <span>{reason}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {selected.job.description && (
                    <div
                      className="border-2 p-2 text-[10px]"
                      style={{
                        backgroundColor: "#FCE9A8",
                        borderColor: "#141311",
                      }}
                    >
                      {selected.job.description.substring(0, 200)}
                      {selected.job.description.length > 200 ? "…" : ""}
                    </div>
                  )}

                  {selected.missing_skills &&
                    selected.missing_skills.length > 0 && (
                      <div
                        className="space-y-1 border-t-2 pt-2"
                        style={{ borderTopColor: "#141311" }}
                      >
                        <div className="text-[10px] font-bold">
                          مهارت‌های گمشده:
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {selected.missing_skills.map((skill) => (
                            <Badge
                              key={skill}
                              variant="outline"
                              className="text-[9px]"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {decisionLoading && (
                <p className="text-xs" style={{ color: "#5A5450" }}>
                  در حال تحلیل تناسب آگهی…
                </p>
              )}

              {decisionError && (
                <p
                  className="break-words text-xs"
                  style={{ color: "#B23A2E" }}
                >
                  تحلیل ناموفق بود: {decisionError}
                </p>
              )}

              {/* Action Buttons */}
              <div
                className="flex shrink-0 flex-wrap gap-1 border-t-2 pt-2"
                style={{ borderTopColor: "#141311" }}
              >
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void analyzeDecision(selected)}
                  disabled={decisionLoading}
                  style={{
                    backgroundColor: "#F2C230",
                    color: "#141311",
                  }}
                >
                  <Sparkles className="size-3" />
                  تحلیل Match
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  style={{
                    borderColor: "#141311",
                    color: "#141311",
                  }}
                  onClick={() => setSelected(null)}
                >
                  بستن
                </Button>
              </div>
            </div>
          )}
        </RetroWindow>
      </div>

      {/* AI Chat */}
      <div className="fixed bottom-4 right-4 z-50">
        {!chatOpen ? (
          <Button
            onClick={() => setChatOpen(true)}
            className="border-2 shadow-md"
            style={{
              backgroundColor: "#F2C230",
              borderColor: "#141311",
              color: "#141311",
            }}
          >
            <Sparkles className="ml-1 size-4" />
            دستیار هوشمند
          </Button>
        ) : (
          <section
            className="flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col border-2 shadow-xl"
            style={{
              backgroundColor: "#FBF7EC",
              borderColor: "#141311",
              color: "#141311",
            }}
            aria-label="گفت‌وگو با دستیار هوشمند"
          >
            <header
              className="flex items-center justify-between gap-2 border-b-2 p-2"
              style={{
                backgroundColor: "#F2C230",
                borderColor: "#141311",
              }}
            >
              <div className="text-xs font-bold">دستیار هوشمند HAMRAH</div>

              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="بستن دستیار"
                onClick={() => setChatOpen(false)}
                style={{ color: "#141311" }}
              >
                ×
              </Button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`max-w-[90%] whitespace-pre-wrap break-words border-2 p-2 text-xs ${
                    message.role === "user" ? "mr-auto" : "ml-auto"
                  }`}
                  style={{
                    backgroundColor:
                      message.role === "user" ? "#FCE9A8" : "#FFFFFF",
                    borderColor: "#141311",
                  }}
                >
                  {message.content}
                </div>
              ))}

              {chatBusy && (
                <p className="text-xs" style={{ color: "#5A5450" }}>
                  دستیار در حال پاسخ‌گویی است…
                </p>
              )}

              <div ref={chatBottom} />
            </div>

            <form
              className="flex gap-1 border-t-2 p-2"
              style={{ borderColor: "#141311" }}
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
                className="h-8 min-w-0 text-xs"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#141311",
                  color: "#141311",
                }}
              />

              <Button
                type="submit"
                size="icon"
                className="size-8 shrink-0"
                aria-label="ارسال پیام"
                disabled={chatBusy || !chatInput.trim()}
                style={{
                  backgroundColor: "#F2C230",
                  color: "#141311",
                }}
              >
                ➤
              </Button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}