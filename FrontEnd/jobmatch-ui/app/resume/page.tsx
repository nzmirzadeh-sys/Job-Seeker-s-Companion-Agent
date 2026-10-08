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
import {
  api,
  getToken,
  streamChat,
  // translateResume,
  type Resume,
  type ResumeContent,
  type ExperienceItem,
} from "@/lib/api";
import {
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

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
  const [resumeList, setResumeList] = useState<Resume[]>([]);
  const [resume, setResume] = useState<Resume | null>(null);
  const [content, setContent] = useState<ResumeContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);

  // New experience form state
  const [newExp, setNewExp] = useState<ExperienceItem>({
    title: "",
    company: "",
    start: "",
    end: "",
    description: "",
    bullets: [],
  });
  const [newBullet, setNewBullet] = useState("");
  const [showAddExp, setShowAddExp] = useState(false);

  // chat
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "سلام! 👋 من ایجنت هوشمند رزومهٔ تو هستم.\nمی‌توانم سوابق شغلی‌ات را بهبود دهم، خلاصه‌ات را حرفه‌ای‌تر کنم یا رزومه‌ات را به انگلیسی ترجمه کنم.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);

  const loadResume = useCallback(async () => {
    try {
      const list = await api<Resume[]>("/resumes/");
      setResumeList(list);
      const active =
        list.find((r) => r.active) ||
        list.sort((a, b) => b.version - a.version)[0] ||
        null;
      if (active) {
        const full = await api<Resume>("/resumes/" + active.id + "/");
        setResume(full);
        setContent({ ...emptyContent, ...full.content });
      }
    } catch {
      toast.error("خطا در بارگذاری رزومه. لطفاً دوباره وارد شوید.");
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
          toast.success("رزومه با موفقیت ساخته شد!");
        }
      });
    } catch {
      toast.error("خطا در ارتباط با ایجنت. دوباره تلاش کنید.");
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
          toast.success("رزومه به‌روزرسانی شد!");
        }
      });
    } catch {
      toast.error("خطا در ارتباط با ایجنت. دوباره تلاش کنید.");
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
      toast.success("تغییرات با موفقیت ذخیره شد.");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("خطا در ذخیره‌سازی. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }

  // async function handleTranslateToEnglish() {
  //   if (!resume) return;
  //   setTranslating(true);
  //   try {
  //     await save();
  //     const newResume = await translateResume(resume.id);
  //     setResume(newResume);
  //     setContent({ ...emptyContent, ...newResume.content });
  //     await loadResume();
  //     toast.success("🎉 نسخه انگلیسی رزومه با موفقیت تولید شد!");
  //   } catch {
  //     toast.error("خطا در ترجمه رزومه. دوباره تلاش کنید.");
  //   } finally {
  //     setTranslating(false);
  //   }
  // }

  async function switchResume(targetId: number) {
    try {
      const full = await api<Resume>("/resumes/" + targetId + "/");
      setResume(full);
      setContent({ ...emptyContent, ...full.content });
      // Mark as active
      await api<Resume>("/resumes/" + targetId + "/", {
        method: "PATCH",
        body: JSON.stringify({ active: true }),
      });
      await loadResume();
    } catch {
      toast.error("خطا در جابجایی بین نسخه‌ها.");
    }
  }

  function set<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  // Experience handlers
  function addExperience() {
    if (!newExp.title.trim() || !newExp.company.trim()) {
      toast.error("لطفاً حداقل عنوان شغلی و نام شرکت را وارد کنید.");
      return;
    }
    const current = content.experiences || [];
    set("experiences", [...current, { ...newExp }]);
    setNewExp({
      title: "",
      company: "",
      start: "",
      end: "",
      description: "",
      bullets: [],
    });
    setShowAddExp(false);
    toast.success("سابقه شغلی جدید اضافه شد ✓");
  }

  function removeExperience(index: number) {
    const current = content.experiences || [];
    set("experiences", current.filter((_, i) => i !== index));
    toast.success("سابقه شغلی حذف شد.");
  }

  function updateExpField<K extends keyof ExperienceItem>(index: number, key: K, val: ExperienceItem[K]) {
    const list = [...(content.experiences || [])];
    list[index] = { ...list[index], [key]: val };
    set("experiences", list);
  }

  function addExpBullet(expIndex: number, bulletText: string) {
    if (!bulletText.trim()) return;
    const list = [...(content.experiences || [])];
    const currentBullets = list[expIndex].bullets || [];
    list[expIndex] = { ...list[expIndex], bullets: [...currentBullets, bulletText.trim()] };
    set("experiences", list);
  }

  function removeExpBullet(expIndex: number, bulletIndex: number) {
    const list = [...(content.experiences || [])];
    const currentBullets = list[expIndex].bullets || [];
    list[expIndex] = { ...list[expIndex], bullets: currentBullets.filter((_, i) => i !== bulletIndex) };
    set("experiences", list);
  }

  const isEnglish = Boolean(
    content.is_english ||
    content.language === "en" ||
    resume?.title?.toLowerCase().includes("english")
  );

  if (loading) {
    return (
      <main className="flex-1 grid place-items-center">
        <div className="animate-pulse text-muted-foreground">در حال بارگذاری استودیو رزومه…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen pb-12">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">استودیوی رزومه</h1>
                {isEnglish ? (
                  <Badge className="bg-sky-600 hover:bg-sky-700 text-white text-[10px]">
                    🇬🇧 English Version
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-indigo-600 border-indigo-200 text-[10px]">
                    🇮🇷 نسخه فارسی
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {resume
                  ? `${resume.title} (نسخه ${resume.version}) — ویرایش سوابق و دریافت PDF`
                  : "هنوز رزومه‌ای نداری"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Version Switcher if multiple versions exist */}
            {resumeList.length > 1 && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs">
                {resumeList.map((r) => {
                  const isCur = r.id === resume?.id;
                  const isEng = r.title.toLowerCase().includes("english");
                  return (
                    <button
                      key={r.id}
                      onClick={() => switchResume(r.id)}
                      className={`px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                        isCur
                          ? "bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-indigo-300"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isEng ? "🇬🇧 English" : `🇮🇷 نسخه ${r.version}`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Translate to English Button */}
            {resume && (
              <Button
                variant={isEnglish ? "outline" : "default"}
                size="sm"
                onClick={handleTranslateToEnglish}
                disabled={translating}
                className={
                  isEnglish
                    ? "border-sky-500 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                    : "bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white shadow-sm"
                }
              >
                <Globe className="size-3.5 ml-1.5" />
                {translating
                  ? "در حال ترجمه تخصصی…"
                  : isEnglish
                  ? "به‌روزرسانی ترجمه انگلیسی"
                  : "تبدیل به نسخه انگلیسی (English CV)"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/analyzer")}
              className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            >
              <Sparkles className="size-3.5 ml-1 text-indigo-500" />
              تحلیل آگهی
            </Button>

            <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>
              آگهی‌ها
            </Button>
          </div>
        </div>

        {!resume ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="size-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 mx-auto flex items-center justify-center">
                <Wand2 className="size-8" />
              </div>
              <div>
                <h3 className="font-bold text-base">هنوز رزومه‌ای ساخته نشده</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  ایجنت می‌تواند از روی مشخصات پروفایلت بلافاصله یک رزومهٔ استاندارد و کامل بسازد تا بتوانی سوابق شغلی را در آن ویرایش کنی.
                </p>
              </div>
              <Button
                onClick={createByAgent}
                disabled={chatBusy}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-medium"
              >
                <Wand2 className="size-4 ml-1.5" />
                ساخت رزومه هوشمند توسط ایجنت
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="edit" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="edit">ویرایش محتوا</TabsTrigger>
                <TabsTrigger value="preview">پیش‌نمایش و PDF</TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Button onClick={save} disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Save className="size-3.5 ml-1" />
                  {saving ? "در حال ذخیره…" : saved ? "ذخیره شد ✓" : "ذخیرهٔ تغییرات"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Download className="size-3.5 ml-1" />
                  دانلود نسخه PDF
                </Button>
              </div>
            </div>

            {/* TAB: EDIT */}
            <TabsContent value="edit" className="grid gap-6 md:grid-cols-2 items-start">
              <div className="space-y-4">
                {/* Basic Info */}
                <Card className="shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <FileText className="size-4 text-indigo-600" />
                      مشخصات فردی و عنوان
                    </h3>
                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">نام و نام خانوادگی</Label>
                        <Input
                          value={content.full_name || ""}
                          onChange={(e) => set("full_name", e.target.value)}
                          placeholder="مثلاً علی رضایی"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">تیتر حرفه‌ای (Headline)</Label>
                        <Input
                          value={content.headline || ""}
                          onChange={(e) => set("headline", e.target.value)}
                          placeholder="مثلاً متخصص علم داده (Data Scientist)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">ایمیل</Label>
                          <Input
                            dir="ltr"
                            value={content.email || ""}
                            onChange={(e) => set("email", e.target.value)}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">شماره تماس</Label>
                          <Input
                            dir="ltr"
                            value={content.phone || ""}
                            onChange={(e) => set("phone", e.target.value)}
                            placeholder="0912..."
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">شهر و منطقه سکونت</Label>
                        <Input
                          value={content.city || ""}
                          onChange={(e) => set("city", e.target.value)}
                          placeholder="مثلاً تهران، شهرری"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">خلاصهٔ حرفه‌ای (Summary)</Label>
                        <Textarea
                          rows={3}
                          value={content.summary || ""}
                          onChange={(e) => set("summary", e.target.value)}
                          placeholder="چکیده‌ای از تخصص، اهداف شغلی و دستاوردهای برجسته شما…"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Skills */}
                <Card className="shadow-xs">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-sm flex items-center justify-between">
                      <span>مهارت‌های تخصصی</span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {(content.skills || []).length} مهارت
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {(content.skills || []).map((s, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="gap-1 py-1 px-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50"
                        >
                          {s.name}
                          <button
                            type="button"
                            onClick={() =>
                              set(
                                "skills",
                                content.skills!.filter((_, j) => j !== i),
                              )
                            }
                            className="hover:text-red-500 cursor-pointer"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.elements.namedItem("skill") as HTMLInputElement;
                        if (input.value.trim()) {
                          set("skills", [...(content.skills || []), { name: input.value.trim() }]);
                          input.value = "";
                        }
                      }}
                      className="flex gap-2 pt-1"
                    >
                      <Input name="skill" placeholder="افزودن مهارت جدید (مثلاً Python، SQL، Docker)…" className="h-9 text-xs" />
                      <Button type="submit" size="sm" variant="secondary" className="shrink-0 h-9">
                        <Plus className="size-3.5 ml-1" />
                        افزودن
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Work Experience Section */}
              <div className="space-y-4">
                <Card className="shadow-xs border-indigo-200/80 dark:border-indigo-900/60">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="size-4 text-indigo-600" />
                        <h3 className="font-bold text-sm">سوابق شغلی و شرح وظایف</h3>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowAddExp(!showAddExp)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                      >
                        <Plus className="size-3.5 ml-1" />
                        {showAddExp ? "بستن فرم" : "افزودن سابقه شغلی"}
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      برای هر جایی که کار کرده‌اید می‌توانید مشخصات سازمان، بازه زمانی، و شرح دقیق کارهایی که شخص انجام داده («چیکارا کرده») را با جزئیات بنویسید.
                    </p>

                    {/* New Experience Form */}
                    {showAddExp && (
                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                        <div className="font-semibold text-xs text-indigo-900 dark:text-indigo-300">
                          اطلاعات موقعیت شغلی جدید:
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">عنوان شغل</Label>
                            <Input
                              value={newExp.title}
                              onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
                              placeholder="مثلاً متخصص علم داده یا توسعه‌دهنده"
                              className="h-8 text-xs bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">شرکت / سازمان</Label>
                            <Input
                              value={newExp.company}
                              onChange={(e) => setNewExp({ ...newExp, company: e.target.value })}
                              placeholder="مثلاً دیجی‌کالا یا اسنپ"
                              className="h-8 text-xs bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">تاریخ شروع</Label>
                            <Input
                              value={newExp.start}
                              onChange={(e) => setNewExp({ ...newExp, start: e.target.value })}
                              placeholder="مثلاً ۱۴۰۱ یا ۲۰۲۲"
                              className="h-8 text-xs bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">تاریخ پایان</Label>
                            <Input
                              value={newExp.end}
                              onChange={(e) => setNewExp({ ...newExp, end: e.target.value })}
                              placeholder="مثلاً تا کنون یا ۱۴۰۳"
                              className="h-8 text-xs bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>

                        {/* Experience Description */}
                        <div className="space-y-1">
                          <Label className="text-[11px]">شرح وظایف و خلاصه سابقه (چیکارا کرده بودید؟)</Label>
                          <Textarea
                            rows={3}
                            value={newExp.description}
                            onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                            placeholder="توضیح دهید در این جایگاه چه مسئولیت‌هایی داشتید، روی چه پروژه‌هایی کار کردید و چه دستاوردهایی خلق کردید…"
                            className="text-xs bg-white dark:bg-slate-900"
                          />
                        </div>

                        {/* Bullets List */}
                        <div className="space-y-2">
                          <Label className="text-[11px]">دستاوردهای کلیدی (Bullet Points)</Label>
                          {newExp.bullets.map((b, bi) => (
                            <div key={bi} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-md border">
                              <span>• {b}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewExp({
                                    ...newExp,
                                    bullets: newExp.bullets.filter((_, idx) => idx !== bi),
                                  })
                                }
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              value={newBullet}
                              onChange={(e) => setNewBullet(e.target.value)}
                              placeholder="اقدام یا دستاورد خاص (مثلاً افزایش ۴۰٪ دقت مدل‌های پیش‌بینی)…"
                              className="h-8 text-xs bg-white dark:bg-slate-900 flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newBullet.trim()) {
                                    setNewExp({ ...newExp, bullets: [...newExp.bullets, newBullet.trim()] });
                                    setNewBullet("");
                                  }
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              onClick={() => {
                                if (newBullet.trim()) {
                                  setNewExp({ ...newExp, bullets: [...newExp.bullets, newBullet.trim()] });
                                  setNewBullet("");
                                }
                              }}
                            >
                              افزودن مورد
                            </Button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => setShowAddExp(false)}
                          >
                            انصراف
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                            onClick={addExperience}
                          >
                            ثبت و ذخیره سابقه
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Existing Experiences List */}
                    <div className="space-y-3">
                      {(content.experiences || []).length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-xs">
                          هنوز سابقه شغلی ثبت نشده است. با دکمه بالا سوابق کاری‌تان را اضافه کنید.
                        </div>
                      ) : (
                        (content.experiences || []).map((exp, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/60 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                              <div>
                                <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                  <Building2 className="size-3.5 text-indigo-500" />
                                  <span>{exp.title}</span>
                                  <span className="text-muted-foreground font-normal">در</span>
                                  <span className="text-indigo-600 dark:text-indigo-400">{exp.company}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="size-3" />
                                  <span>{exp.start || "—"}</span>
                                  <span>تا</span>
                                  <span>{exp.end || "کنون"}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeExperience(i)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                title="حذف این سابقه"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>

                            {/* Editable Description */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">شرح وظایف و اقدامات انجام شده:</Label>
                              <Textarea
                                rows={2}
                                value={exp.description || ""}
                                onChange={(e) => updateExpField(i, "description", e.target.value)}
                                placeholder="چه کارهایی انجام دادید؟ چه نتایجی حاصل شد؟"
                                className="text-xs resize-none"
                              />
                            </div>

                            {/* Bullets List */}
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-muted-foreground font-medium">دستاوردهای خاص:</div>
                              {(exp.bullets || []).map((b, bi) => (
                                <div
                                  key={bi}
                                  className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-md"
                                >
                                  <span className="leading-relaxed">• {b}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeExpBullet(i, bi)}
                                    className="text-slate-400 hover:text-red-500 mr-2"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </div>
                              ))}
                              {/* Add bullet inline */}
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const input = e.currentTarget.elements.namedItem("binput") as HTMLInputElement;
                                  if (input.value.trim()) {
                                    addExpBullet(i, input.value.trim());
                                    input.value = "";
                                  }
                                }}
                                className="flex gap-1.5 pt-1"
                              >
                                <Input
                                  name="binput"
                                  placeholder="افزودن دستاورد جدید (Enter)…"
                                  className="h-7 text-xs flex-1"
                                />
                                <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs px-2">
                                  +
                                </Button>
                              </form>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: PREVIEW */}
            <TabsContent value="preview">
              <div className="grid gap-6 md:grid-cols-3 items-start">
                <div className="md:col-span-2">
                  <Card className="overflow-hidden shadow-lg border-slate-300 dark:border-slate-700">
                    <CardContent
                      className={`p-10 space-y-6 bg-white text-slate-900 ${
                        isEnglish ? "font-sans" : "font-sans"
                      }`}
                      dir={isEnglish ? "ltr" : "rtl"}
                    >
                      {/* resume paper preview */}
                      <header className="border-b-4 border-indigo-600 pb-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                              {content.full_name || (isEnglish ? "Your Name" : "نام شما")}
                            </h1>
                            {content.headline && (
                              <p className="text-indigo-600 font-semibold text-sm mt-1">
                                {content.headline}
                              </p>
                            )}
                          </div>
                          {isEnglish && (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              Curriculum Vitae
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-3 flex flex-wrap gap-4 font-medium">
                          {content.email && <span>✉ {content.email}</span>}
                          {content.phone && <span>☎ {content.phone}</span>}
                          {content.city && <span>📍 {content.city}</span>}
                        </p>
                      </header>

                      {content.summary && (
                        <section className="space-y-1.5">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                            {isEnglish ? "Professional Summary" : "خلاصهٔ حرفه‌ای"}
                          </h2>
                          <p className="text-xs leading-relaxed text-slate-700">
                            {content.summary}
                          </p>
                        </section>
                      )}

                      {content.skills?.length ? (
                        <section className="space-y-2">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                            {isEnglish ? "Core Technical Skills" : "مهارت‌های تخصصی"}
                          </h2>
                          <div className="flex flex-wrap gap-1.5">
                            {content.skills.map((s, i) => (
                              <span
                                key={i}
                                className="rounded-md bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium border border-indigo-100"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {/* Work Experience in Preview */}
                      {content.experiences?.length ? (
                        <section className="space-y-3">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                            {isEnglish ? "Work Experience" : "سوابق شغلی"}
                          </h2>
                          <div className="space-y-4">
                            {content.experiences.map((e, i) => (
                              <div key={i} className="text-xs space-y-1">
                                <div className="flex justify-between items-baseline font-bold text-slate-900">
                                  <span>{e.title} — {e.company}</span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    {e.start}{" "}
                                    {e.end ? (isEnglish ? `– ${e.end}` : `تا ${e.end}`) : (isEnglish ? "– Present" : "تا کنون")}
                                  </span>
                                </div>
                                {e.description && (
                                  <p className="text-slate-600 leading-relaxed text-[11.5px]">
                                    {e.description}
                                  </p>
                                )}
                                {e.bullets?.length ? (
                                  <ul className="list-disc pr-4 pl-4 space-y-0.5 text-slate-600 text-[11.5px]">
                                    {e.bullets.map((b, bi) => (
                                      <li key={bi}>{b}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {content.educations?.length ? (
                        <section className="space-y-2">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                            {isEnglish ? "Education" : "تحصیلات"}
                          </h2>
                          <div className="space-y-2">
                            {content.educations.map((e, i) => (
                              <div key={i} className="text-xs">
                                <b>{e.degree}</b> — {e.school}
                                <span className="text-slate-500 mr-2 ml-2">
                                  ({e.start} {e.end ? (isEnglish ? `- ${e.end}` : `تا ${e.end}`) : ""})
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {content.languages?.length ? (
                        <section className="space-y-1.5">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                            {isEnglish ? "Languages" : "زبان‌ها"}
                          </h2>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {content.languages.map((l, i) => (
                              <span key={i} className="text-slate-700">
                                • {l.name} {l.level ? `(${l.level})` : ""}
                              </span>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                {/* Agent Chat Column */}
                <div className="space-y-3">
                  <Card className="sticky top-4 shadow-md">
                    <CardContent className="p-0">
                      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-3 rounded-t-xl text-sm font-semibold flex items-center gap-2">
                        <Bot className="size-4" />
                        ایجنت رزومه‌ساز
                      </div>
                      <div className="max-h-[50vh] overflow-y-auto p-3.5 space-y-2.5">
                        {messages.map((m, i) => (
                          <div
                            key={i}
                            className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={
                                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed " +
                                (m.role === "user"
                                  ? "bg-indigo-600 text-white rounded-bl-sm"
                                  : "bg-muted text-foreground rounded-br-sm border")
                              }
                            >
                              {m.content}
                            </div>
                          </div>
                        ))}
                        {chatBusy && (
                          <div className="text-center text-xs text-muted-foreground py-1 animate-pulse">
                            ایجنت در حال تفکر و اعمال تغییرات…
                          </div>
                        )}
                        <div ref={chatBottom} />
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendChat();
                        }}
                        className="flex gap-2 border-t p-3 bg-background"
                      >
                        <Input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="مثلاً: خلاصه شغلی‌ام را جذاب‌تر کن، یا رزومه‌ام را انگلیسی کن…"
                          className="h-9 text-xs"
                        />
                        <Button size="icon" className="size-9 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={chatBusy}>
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
