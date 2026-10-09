"use client";

import { useCallback, useEffect, useState } from "react";
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
  type Resume,
  type ResumeContent,
  type ExperienceItem,
} from "@/lib/api";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Download,
  FileText,
  Languages,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

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

// ─── Direction toggle ───────────────────────────────────────────────────────
type Dir = "rtl" | "ltr";

function DirToggle({ dir, onChange }: { dir: Dir; onChange: (d: Dir) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("rtl")}
        className={`px-3 py-1.5 transition-colors ${
          dir === "rtl"
            ? "bg-indigo-600 text-white"
            : "bg-white dark:bg-slate-900 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        <Languages className="size-3.5 ml-1 inline-block" />
        راست‌چین (فارسی)
      </button>
      <button
        type="button"
        onClick={() => onChange("ltr")}
        className={`px-3 py-1.5 transition-colors border-r dark:border-slate-700 ${
          dir === "ltr"
            ? "bg-indigo-600 text-white"
            : "bg-white dark:bg-slate-900 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        LTR (English)
      </button>
    </div>
  );
}

export default function ResumePage() {
  const router = useRouter();
  const [resume, setResume] = useState<Resume | null>(null);
  const [content, setContent] = useState<ResumeContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewDir, setPreviewDir] = useState<Dir>("rtl");
  const [creatingResume, setCreatingResume] = useState(false);

  // New experience form
  const [newExp, setNewExp] = useState<ExperienceItem>({
    title: "", company: "", start: "", end: "", description: "", bullets: [],
  });
  const [newBullet, setNewBullet] = useState("");
  const [showAddExp, setShowAddExp] = useState(false);

  const loadResume = useCallback(async () => {
    try {
      const list = await api<Resume[]>("/resumes/");
      // Only pick the active (or latest non-English) resume
      const filtered = list.filter((r) => !r.title.toLowerCase().includes("english"));
      const active = filtered.find((r) => r.active) || filtered[0] || list[0] || null;
      if (active) {
        const full = await api<Resume>("/resumes/" + active.id + "/");
        setResume(full);
        setContent({ ...emptyContent, ...full.content });
        // Auto-detect direction from content
        if (full.content?.language === "en" || full.content?.is_english) {
          setPreviewDir("ltr");
        }
      }
    } catch {
      toast.error("خطا در بارگذاری رزومه.");
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }
    loadResume();
  }, [loadResume, router]);

  async function createBlankResume() {
    setCreatingResume(true);
    try {
      const newR = await api<Resume>("/resumes/", {
        method: "POST",
        body: JSON.stringify({ title: "رزومهٔ من", content: emptyContent }),
      });
      setResume(newR);
      setContent({ ...emptyContent, ...newR.content });
      toast.success("رزومه جدید ساخته شد ✓");
    } catch {
      toast.error("خطا در ساخت رزومه.");
    } finally {
      setCreatingResume(false);
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
      toast.success("تغییرات ذخیره شد.");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("خطا در ذخیره‌سازی.");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  // ─── Experience handlers ─────────────────────────────────────────────────
  function addExperience() {
    if (!newExp.title.trim() || !newExp.company.trim()) {
      toast.error("حداقل عنوان شغلی و نام شرکت را وارد کنید.");
      return;
    }
    set("experiences", [...(content.experiences || []), { ...newExp }]);
    setNewExp({ title: "", company: "", start: "", end: "", description: "", bullets: [] });
    setShowAddExp(false);
    toast.success("سابقه شغلی اضافه شد ✓");
  }

  function removeExperience(index: number) {
    set("experiences", (content.experiences || []).filter((_, i) => i !== index));
  }

  function updateExpField<K extends keyof ExperienceItem>(idx: number, key: K, val: ExperienceItem[K]) {
    const list = [...(content.experiences || [])];
    list[idx] = { ...list[idx], [key]: val };
    set("experiences", list);
  }

  function addExpBullet(expIdx: number, text: string) {
    if (!text.trim()) return;
    const list = [...(content.experiences || [])];
    list[expIdx] = { ...list[expIdx], bullets: [...(list[expIdx].bullets || []), text.trim()] };
    set("experiences", list);
  }

  function removeExpBullet(expIdx: number, bIdx: number) {
    const list = [...(content.experiences || [])];
    list[expIdx] = { ...list[expIdx], bullets: (list[expIdx].bullets || []).filter((_, i) => i !== bIdx) };
    set("experiences", list);
  }

  if (loading) {
    return (
      <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950 grid place-items-center">
        <div className="animate-pulse text-muted-foreground text-sm">در حال بارگذاری رزومه…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/jobs")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="size-4" />
              <span className="hidden sm:inline">آگهی‌ها</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <FileText className="size-3.5" />
              </div>
              <span className="font-bold text-sm">استودیوی رزومه</span>
            </div>
          </div>

          {resume && (
            <div className="flex items-center gap-2">
              <Button
                onClick={save}
                disabled={saving}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
              >
                <Save className="size-3.5 ml-1" />
                {saving ? "ذخیره…" : saved ? "ذخیره شد ✓" : "ذخیره"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8 text-xs"
                onClick={async () => {
                  await save();
                  window.open(
                    (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api") +
                      "/resumes/" + resume.id + "/pdf/",
                    "_blank",
                  );
                }}
              >
                <Download className="size-3.5 ml-1" />
                PDF
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        {!resume ? (
          /* ─── Empty state ─────────────────────────────────────────────── */
          <Card className="border-dashed border-2 shadow-none max-w-md mx-auto mt-10">
            <CardContent className="p-10 text-center space-y-5">
              <div className="size-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mx-auto">
                <FileText className="size-8" />
              </div>
              <div>
                <h3 className="font-bold">هنوز رزومه‌ای نداری</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  یه رزومه خالی بساز و شروع به پر کردنش کن، یا از صفحه آگهی‌ها از ایجنت بخواه که از روی پروفایلت رزومه بسازه.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={createBlankResume}
                  disabled={creatingResume}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="size-4 ml-1.5" />
                  {creatingResume ? "در حال ساخت…" : "ساخت رزومه جدید"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/analyzer")}
                >
                  <Sparkles className="size-4 ml-1.5 text-indigo-500" />
                  تحلیل آگهی
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ─── Main editor ─────────────────────────────────────────────── */
          <Tabs defaultValue="edit" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="h-9">
                <TabsTrigger value="edit" className="text-xs">ویرایش محتوا</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">پیش‌نمایش</TabsTrigger>
              </TabsList>
              <div className="text-xs text-muted-foreground">
                {resume.title} — نسخه {resume.version}
              </div>
            </div>

            {/* ═══ TAB: EDIT ════════════════════════════════════════════════ */}
            <TabsContent value="edit" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 items-start">
                {/* Left column */}
                <div className="space-y-4">
                  {/* Personal info */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <FileText className="size-4 text-indigo-500" />
                        مشخصات فردی
                      </h3>
                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">نام و نام خانوادگی</Label>
                          <Input value={content.full_name || ""} onChange={(e) => set("full_name", e.target.value)} placeholder="علی رضایی" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">عنوان حرفه‌ای</Label>
                          <Input value={content.headline || ""} onChange={(e) => set("headline", e.target.value)} placeholder="مثلاً Senior Frontend Developer" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">ایمیل</Label>
                            <Input dir="ltr" value={content.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">تلفن</Label>
                            <Input dir="ltr" value={content.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="0912..." />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">شهر</Label>
                          <Input value={content.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="تهران" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">خلاصه حرفه‌ای</Label>
                          <Textarea rows={3} value={content.summary || ""} onChange={(e) => set("summary", e.target.value)} placeholder="چکیده تخصص و اهداف شغلی…" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Skills */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-bold text-sm flex items-center justify-between">
                        <span>مهارت‌ها</span>
                        <span className="text-[11px] text-muted-foreground font-normal">{(content.skills || []).length} مهارت</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(content.skills || []).map((s, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 py-1 px-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50">
                            {s.name}
                            <button type="button" onClick={() => set("skills", content.skills!.filter((_, j) => j !== i))} className="hover:text-red-500 cursor-pointer">
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const inp = e.currentTarget.elements.namedItem("skill") as HTMLInputElement;
                          if (inp.value.trim()) {
                            set("skills", [...(content.skills || []), { name: inp.value.trim() }]);
                            inp.value = "";
                          }
                        }}
                        className="flex gap-2"
                      >
                        <Input name="skill" placeholder="Python، React، Docker…" className="h-8 text-xs" />
                        <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 text-xs">
                          <Plus className="size-3 ml-1" />افزودن
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Right column — experiences */}
                <div className="space-y-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Briefcase className="size-4 text-indigo-500" />
                          سوابق شغلی
                        </h3>
                        <Button
                          size="sm"
                          onClick={() => setShowAddExp(!showAddExp)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3"
                        >
                          <Plus className="size-3 ml-1" />
                          {showAddExp ? "بستن" : "افزودن"}
                        </Button>
                      </div>

                      {/* Add experience form */}
                      {showAddExp && (
                        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">عنوان شغل</Label>
                              <Input value={newExp.title} onChange={(e) => setNewExp({ ...newExp, title: e.target.value })} placeholder="مثلاً Frontend Developer" className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">شرکت</Label>
                              <Input value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="مثلاً دیجی‌کالا" className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">شروع</Label>
                              <Input value={newExp.start} onChange={(e) => setNewExp({ ...newExp, start: e.target.value })} placeholder="۱۴۰۱ یا 2022" className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">پایان</Label>
                              <Input value={newExp.end} onChange={(e) => setNewExp({ ...newExp, end: e.target.value })} placeholder="تا کنون" className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">شرح وظایف</Label>
                            <Textarea rows={3} value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="چه کارهایی انجام دادید؟" className="text-xs" />
                          </div>
                          {/* Bullets */}
                          <div className="space-y-1.5">
                            <Label className="text-[11px]">دستاوردهای کلیدی</Label>
                            {newExp.bullets.map((b, bi) => (
                              <div key={bi} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-md border">
                                <span>• {b}</span>
                                <button type="button" onClick={() => setNewExp({ ...newExp, bullets: newExp.bullets.filter((_, idx) => idx !== bi) })} className="text-muted-foreground hover:text-red-500">
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Input value={newBullet} onChange={(e) => setNewBullet(e.target.value)} placeholder="یک دستاورد خاص…" className="h-7 text-xs flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); if (newBullet.trim()) { setNewExp({ ...newExp, bullets: [...newExp.bullets, newBullet.trim()] }); setNewBullet(""); } }
                                }}
                              />
                              <Button type="button" size="sm" variant="secondary" className="h-7 text-xs shrink-0" onClick={() => { if (newBullet.trim()) { setNewExp({ ...newExp, bullets: [...newExp.bullets, newBullet.trim()] }); setNewBullet(""); } }}>+</Button>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1 border-t">
                            <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowAddExp(false)}>انصراف</Button>
                            <Button type="button" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7" onClick={addExperience}>ثبت سابقه</Button>
                          </div>
                        </div>
                      )}

                      {/* Existing experiences */}
                      <div className="space-y-3">
                        {(content.experiences || []).length === 0 ? (
                          <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-xs">
                            هنوز سابقه شغلی ثبت نشده
                          </div>
                        ) : (
                          (content.experiences || []).map((exp, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/60">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-sm flex items-center gap-1.5">
                                    <Building2 className="size-3.5 text-indigo-500" />
                                    {exp.title}
                                    <span className="text-muted-foreground font-normal text-xs">در</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{exp.company}</span>
                                  </div>
                                  {(exp.start || exp.end) && (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Calendar className="size-3" />
                                      {exp.start || "—"} تا {exp.end || "کنون"}
                                    </div>
                                  )}
                                </div>
                                <button type="button" onClick={() => removeExperience(i)} className="text-muted-foreground hover:text-red-500 p-1 transition-colors">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                              <Textarea rows={2} value={exp.description || ""} onChange={(e) => updateExpField(i, "description", e.target.value)} placeholder="شرح وظایف…" className="text-xs resize-none" />
                              <div className="space-y-1">
                                {(exp.bullets || []).map((b, bi) => (
                                  <div key={bi} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-md">
                                    <span>• {b}</span>
                                    <button type="button" onClick={() => removeExpBullet(i, bi)} className="text-muted-foreground hover:text-red-500 mr-2">
                                      <X className="size-3" />
                                    </button>
                                  </div>
                                ))}
                                <form onSubmit={(e) => { e.preventDefault(); const inp = e.currentTarget.elements.namedItem("b") as HTMLInputElement; if (inp.value.trim()) { addExpBullet(i, inp.value.trim()); inp.value = ""; } }} className="flex gap-1.5">
                                  <Input name="b" placeholder="دستاورد جدید…" className="h-7 text-xs flex-1" />
                                  <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs px-2">+</Button>
                                </form>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ═══ TAB: PREVIEW ══════════════════════════════════════════════ */}
            <TabsContent value="preview">
              <div className="space-y-4">
                {/* Direction toggle */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Languages className="size-4" />
                    <span>جهت متن رزومه:</span>
                  </div>
                  <DirToggle dir={previewDir} onChange={setPreviewDir} />
                </div>

                {/* Resume paper */}
                <Card className="overflow-hidden shadow-lg border-slate-300 dark:border-slate-700">
                  <CardContent
                    className="p-10 space-y-6 bg-white text-slate-900"
                    dir={previewDir}
                  >
                    {/* Header */}
                    <header className="border-b-4 border-indigo-600 pb-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            {content.full_name || (previewDir === "ltr" ? "Your Name" : "نام شما")}
                          </h1>
                          {content.headline && (
                            <p className="text-indigo-600 font-semibold text-sm mt-1">{content.headline}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-4 font-medium">
                        {content.email && <span>✉ {content.email}</span>}
                        {content.phone && <span>☎ {content.phone}</span>}
                        {content.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> {content.city}
                          </span>
                        )}
                      </div>
                    </header>

                    {content.summary && (
                      <section className="space-y-1.5">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                          {previewDir === "ltr" ? "Professional Summary" : "خلاصه حرفه‌ای"}
                        </h2>
                        <p className="text-xs leading-relaxed text-slate-700">{content.summary}</p>
                      </section>
                    )}

                    {content.skills?.length ? (
                      <section className="space-y-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                          {previewDir === "ltr" ? "Technical Skills" : "مهارت‌های تخصصی"}
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          {content.skills.map((s, i) => (
                            <span key={i} className="rounded-md bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium border border-indigo-100">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {content.experiences?.length ? (
                      <section className="space-y-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                          {previewDir === "ltr" ? "Work Experience" : "سوابق شغلی"}
                        </h2>
                        <div className="space-y-4">
                          {content.experiences.map((e, i) => (
                            <div key={i} className="text-xs space-y-1">
                              <div className="flex justify-between items-baseline font-bold text-slate-900">
                                <span>{e.title} — {e.company}</span>
                                <span className="text-[11px] text-slate-500 font-normal">
                                  {e.start}{e.end ? (previewDir === "ltr" ? ` – ${e.end}` : ` تا ${e.end}`) : (previewDir === "ltr" ? " – Present" : " تا کنون")}
                                </span>
                              </div>
                              {e.description && <p className="text-slate-600 leading-relaxed text-[11.5px]">{e.description}</p>}
                              {e.bullets?.length ? (
                                <ul className={`list-disc space-y-0.5 text-slate-600 text-[11.5px] ${previewDir === "ltr" ? "pl-4" : "pr-4"}`}>
                                  {e.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
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
                          {previewDir === "ltr" ? "Education" : "تحصیلات"}
                        </h2>
                        <div className="space-y-2">
                          {content.educations.map((e, i) => (
                            <div key={i} className="text-xs">
                              <b>{e.degree}</b> — {e.school}
                              <span className="text-slate-500 mx-2">({e.start}{e.end ? ` – ${e.end}` : ""})</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {content.languages?.length ? (
                      <section className="space-y-1.5">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b pb-1">
                          {previewDir === "ltr" ? "Languages" : "زبان‌ها"}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {content.languages.map((l, i) => (
                            <span key={i} className="text-slate-700">• {l.name}{l.level ? ` (${l.level})` : ""}</span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
