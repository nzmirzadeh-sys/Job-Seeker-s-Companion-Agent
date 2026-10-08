"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, getToken, streamChat, type Resume, type ResumeContent } from "@/lib/api";
import { Bot, Download, FileText, Plus, Save, Send, Wand2, X } from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const emptyContent: ResumeContent = {
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  city: "",
  summary: "",
  skills: [],
  experiences: [],
  projects: [],
  educations: [],
  languages: [{ name: "فارسی", level: "زبان مادری" }],
  links: [],
};

export default function ResumePage() {
  const router = useRouter();
  const [resume, setResume] = useState<Resume | null>(null);
  const [content, setContent] = useState<ResumeContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // chat
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "سلام! از روی پروفایلت رزومه می‌سازم. یا بگو «بساز» تا خودم نسخهٔ اول بسازم، یا تجربه‌هات رو تعریف کن تا اضافه‌شان کنم. بعد از هر تغییر می‌تونی پیش‌نمایش و PDF بگیری.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);

  const loadResume = useCallback(async () => {
    try {
      const list = await api<Resume[]>("/resumes/");
      const active =
        list.filter((r) => r.active).sort((a, b) => b.version - a.version)[0] ||
        null;
      if (active) {
        const full = await api<Resume>("/resumes/" + active.id + "/");
        setResume(full);
        setContent({ ...emptyContent, ...full.content });
      }
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
    loadResume();
  }, [loadResume, router]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function createByAgent() {
    setChatBusy(true);
    setMessages((m) => [...m, { role: "user", content: "رزومه‌ام رو بساز" }]);
    try {
      await streamChat("لطفاً از روی پروفایل من یک رزومهٔ کامل بساز.", "resume", (event) => {
        if (event.type === "assistant" && event.text) {
          setMessages((m) => [...m, { role: "assistant", content: event.text! }]);
        }
        if (event.type === "resume_updated") {
          loadResume();
        }
      });
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "خطا در ارتباط با ایجنت." }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setChatInput("");
    setChatBusy(true);
    try {
      await streamChat(text, "resume", (event) => {
        if (event.type === "assistant" && event.text) {
          setMessages((m) => [...m, { role: "assistant", content: event.text! }]);
        }
        if (event.type === "resume_updated") {
          loadResume();
        }
      });
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "خطا در ارتباط با ایجنت." }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function save() {
    if (!resume) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api<Resume>("/resumes/" + resume.id + "/", {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setResume(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  if (loading) {
    return (
      <main className="flex-1 grid place-items-center">
        <div className="animate-pulse text-muted-foreground">در حال بارگذاری…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">استودیوی رزومه</h1>
              <p className="text-xs text-muted-foreground">
                {resume
                  ? "نسخهٔ " + resume.version + " — ویرایش زنده و خروجی PDF"
                  : "هنوز رزومه‌ای نداری"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>
              بازگشت به آگهی‌ها
            </Button>
          </div>
        </div>

        {!resume ? (
          <Card>
            <CardContent className="p-10 text-center space-y-4">
              <Wand2 className="size-10 mx-auto text-indigo-500" />
              <p className="text-muted-foreground">
                هنوز رزومه‌ای ساخته نشده. ایجنت از روی پروفایلت نسخهٔ اول را
                می‌سازد — بعد می‌توانی ویرایشش کنی.
              </p>
              <Button onClick={createByAgent} disabled={chatBusy}>
                <Wand2 className="size-4" />
                ساخت رزومه توسط ایجنت
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="edit">
            <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto mb-4">
              <TabsTrigger value="edit">ویرایش</TabsTrigger>
              <TabsTrigger value="preview">پیش‌نمایش</TabsTrigger>
            </TabsList>

            {/* EDIT */}
            <TabsContent value="edit" className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">اطلاعات پایه</h3>
                  <div className="grid gap-3">
                    <div className="space-y-1.5">
                      <Label>نام کامل</Label>
                      <Input
                        value={content.full_name || ""}
                        onChange={(e) => set("full_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>تیتر حرفه‌ای</Label>
                      <Input
                        value={content.headline || ""}
                        onChange={(e) => set("headline", e.target.value)}
                        placeholder="مثلاً توسعه‌دهنده جونیور فرانت‌اند"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>ایمیل</Label>
                        <Input dir="ltr" value={content.email || ""} onChange={(e) => set("email", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>موبایل</Label>
                        <Input dir="ltr" value={content.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>شهر</Label>
                      <Input value={content.city || ""} onChange={(e) => set("city", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>خلاصهٔ حرفه‌ای</Label>
                      <Textarea
                        rows={3}
                        value={content.summary || ""}
                        onChange={(e) => set("summary", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-sm">مهارت‌ها</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {(content.skills || []).map((s, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {s.name}
                          <button
                            onClick={() =>
                              set("skills", content.skills!.filter((_, j) => j !== i))
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.currentTarget.elements.namedItem("skill") as HTMLInputElement);
                        if (input.value.trim()) {
                          set("skills", [
                            ...(content.skills || []),
                            { name: input.value.trim() },
                          ]);
                          input.value = "";
                        }
                      }}
                      className="flex gap-2"
                    >
                      <Input name="skill" placeholder="مهارت جدید…" className="h-9" />
                      <Button type="submit" size="icon" className="size-9" variant="secondary">
                        <Plus className="size-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-sm">سوابق شغلی</h3>
                    {(content.experiences || []).map((exp, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <b className="text-xs">{exp.title} — {exp.company}</b>
                          <button
                            className="text-destructive"
                            onClick={() =>
                              set(
                                "experiences",
                                content.experiences!.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-muted-foreground">
                          {exp.start} تا {exp.end || "کنون"}
                        </p>
                        {exp.bullets?.map((b, k) => (
                          <p key={k}>• {b}</p>
                        ))}
                      </div>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const title = (form.elements.namedItem("etitle") as HTMLInputElement).value;
                        const company = (form.elements.namedItem("ecompany") as HTMLInputElement).value;
                        if (title && company) {
                          set("experiences", [
                            ...(content.experiences || []),
                            { title, company, start: "", end: "", bullets: [] },
                          ]);
                          form.reset();
                        }
                      }}
                      className="flex gap-2"
                    >
                      <Input name="etitle" placeholder="عنوان شغلی…" className="h-9" />
                      <Input name="ecompany" placeholder="شرکت…" className="h-9" />
                      <Button type="submit" size="icon" className="size-9 shrink-0" variant="secondary">
                        <Plus className="size-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button onClick={save} disabled={saving} className="flex-1">
                    <Save className="size-4" />
                    {saving ? "ذخیره…" : saved ? "ذخیره شد ✓" : "ذخیرهٔ تغییرات"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={async () => {
                      await save();
                      window.open(
                        (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api") +
                          "/resumes/" +
                          resume.id +
                          "/pdf/",
                        "_blank",
                      );
                    }}
                  >
                    <Download className="size-4" />
                    دانلود PDF
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* PREVIEW */}
            <TabsContent value="preview">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Card className="overflow-hidden">
                    <CardContent className="p-8 space-y-5 bg-white text-slate-900" dir="rtl">
                      {/* resume paper preview */}
                      <header className="border-b-4 border-indigo-600 pb-4">
                        <h1 className="text-2xl font-extrabold">
                          {content.full_name || "نام شما"}
                        </h1>
                        {content.headline ? (
                          <p className="text-indigo-600 mt-1">{content.headline}</p>
                        ) : null}
                        <p className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                          {content.email ? <span>✉ {content.email}</span> : null}
                          {content.phone ? <span>☎ {content.phone}</span> : null}
                          {content.city ? <span>📍 {content.city}</span> : null}
                        </p>
                      </header>

                      {content.summary ? (
                        <section>
                          <h2 className="text-sm font-bold text-indigo-900 border-b pb-1 mb-2">خلاصهٔ حرفه‌ای</h2>
                          <p className="text-sm leading-relaxed text-slate-700">{content.summary}</p>
                        </section>
                      ) : null}

                      {content.skills?.length ? (
                        <section>
                          <h2 className="text-sm font-bold text-indigo-900 border-b pb-1 mb-2">مهارت‌ها</h2>
                          <div className="flex flex-wrap gap-1.5">
                            {content.skills.map((s, i) => (
                              <span key={i} className="rounded-full bg-indigo-50 text-indigo-700 px-3 py-0.5 text-xs">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {content.experiences?.length ? (
                        <section>
                          <h2 className="text-sm font-bold text-indigo-900 border-b pb-1 mb-2">سوابق شغلی</h2>
                          <div className="space-y-3">
                            {content.experiences.map((e, i) => (
                              <div key={i} className="text-sm">
                                <div className="font-bold">{e.title} — {e.company}</div>
                                <div className="text-xs text-slate-500">
                                  {e.start} {e.end ? "تا " + e.end : "تا کنون"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {content.educations?.length ? (
                        <section>
                          <h2 className="text-sm font-bold text-indigo-900 border-b pb-1 mb-2">تحصیلات</h2>
                          <div className="space-y-2">
                            {content.educations.map((e, i) => (
                              <div key={i} className="text-sm">
                                <b>{e.degree}</b> — {e.school}
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                {/* agent chat column */}
                <div className="space-y-3">
                  <Card className="sticky top-4">
                    <CardContent className="p-0">
                      <div className="bg-indigo-600 text-white px-4 py-3 rounded-t-xl text-sm font-medium flex items-center gap-2">
                        <Bot className="size-4" />
                        ایجنت رزومه
                      </div>
                      <div className="max-h-[50vh] overflow-y-auto p-3 space-y-2">
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
                          <div className="text-center text-xs text-muted-foreground py-1">…</div>
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
                          placeholder="مثلاً: خلاصه‌ام رو حرفه‌ای‌تر بازنویسی کن…"
                          className="h-9 text-xs"
                        />
                        <Button size="icon" className="size-9" disabled={chatBusy}>
                          <Send className="size-4 rotate-180" />
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
