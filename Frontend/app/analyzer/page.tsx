"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeJob,
  getToken,
  clearToken,
  type AnalyzedJob,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Quote,
  Briefcase,
  Layers,
  GraduationCap,
  Clock,
  Coins,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Building2,
  MapPin,
  Cpu,
  Wrench,
} from "lucide-react";

// Pre-defined realistic samples for quick one-click analysis
const SAMPLES = [
  {
    label: "برنامه‌نویس ارشد پایتون و جنگو",
    company: "فناوری اطلاعات فردا",
    text: `عنوان شغلی: برنامه‌نویس ارشد پایتون (Senior Python Developer)
شرکت فناوری اطلاعات فردا - تهران (امکان دورکاری ۲ روز در هفته)
نوع همکاری: تمام وقت

درباره موقعیت شغلی:
ما در تیم توسعه محصول به دنبال یک توسعه‌دهنده ارشد پایتون با تجربه و خلاق هستیم تا در توسعه و مقیاس‌پذیری سرویس‌های پردازش داده با ما همکاری کند.

مسئولیت‌ها:
• طراحی و پیاده‌سازی میکروسرویس‌های پایدار با کارایی بالا
• بهینه‌سازی کوئری‌های دیتابیس و طراحی ساختار داده مناسب
• همکاری نزدیک با تیم زیرساخت و فرانت‌اند برای ارائه APIهای استاندارد
• مشارکت در فرآیند Code Review و ارتقای کیفیت کد تیم

شرایط احراز و مهارت‌های الزامی:
• حداقل ۴ سال سابقه کار حرفه‌ای در توسعه با Python
• تسلط کامل به فریم‌ورک Django و Django REST Framework
• تسلط عمیق به پایگاه داده PostgreSQL و ابزارهای مانیتورینگ کوئری
• تجربه کار عملی با Docker و کانتینرسازی سرویس‌ها
• آشنایی کامل با Git و جریان‌های کاری شاخه‌بندی
• تسلط به مفاهیم طراحی RESTful API

مهارت‌های ترجیحی و مزیت‌ها:
• آشنایی با Redis و معماری کشینگ مزیت محسوب می‌شود.
• تجربه کار با سیستم‌های پیام‌رسان مانند RabbitMQ یا Kafka یک پوئن مثبت است.
• تسلط به Kubernetes ترجیحاً امتیاز خواهد داشت.

تحصیلات و شرایط عمومی:
• کارشناسی یا کارشناسی ارشد مهندسی کامپیوتر یا رشته‌های مرتبط
• تسلط به زبان انگلیسی در سطح درک متون تخصصی
حقوق پیشنهادی: توافقی بر اساس شایستگی (بین ۶۰ تا ۸۰ میلیون تومان)`,
  },
  {
    label: "توسعه‌دهنده فرانت‌اند React و Next.js",
    company: "استارتاپ آوان",
    text: `استخدام Frontend Developer (React / Next.js)
شرکت نوآوران آوان - اصفهان / دورکاری کامل

شرح موقعیت:
تیم فنی آوان جهت توسعه پنل‌های تحت وب مقیاس‌پذیر نیازمند توسعه‌دهنده توانمند فرانت‌اند است.

مهارت‌های لازم و ضروری:
• تسلط کامل به JavaScript مدرن (ES6+) و TypeScript
• مسلط به React.js و درک عمیق React Hooks و چرخه حیات کامپوننت‌ها
• تسلط کاربردی به فریم‌ورک Next.js (App Router و Server Actions)
• تجربه کار با Tailwind CSS و پیاده‌سازی UI کاملاً Responsive
• مسلط به مصرف REST API و ابزارهای مدیریت استیت مانند Redux یا Zustand
• تجربه کار با ابزار کنترل نسخه Git

موارد مزیت و ترجیحی:
• تجربه کار با Figma و توانایی تعامل با طراح محصول مزیت است.
• آشنایی با آزمون‌نویسی کامپوننت‌ها (Jest یا Vitest) امتیاز مثبت دارد.

شرایط سابقه:
حداقل ۲ تا ۳ سال سابقه کار تخصصی فرانت‌اند
مدرک تحصیلی: کارشناسی نرم‌افزار`,
  },
  {
    label: "مهندس DevOps و زیرساخت کلاود",
    company: "ابر داده پرداز",
    text: `استخدام مهندس دواپس (DevOps Engineer)
مجموعه ابر داده پرداز - تهران
نوع همکاری: تمام وقت حضوری / هیبریدی

مهارت‌های الزامی:
• حداقل ۳ سال تجربه کاری در نقش DevOps
• تسلط کامل به سیستم عامل Linux و اسکریپت‌نویسی Bash و Python
• تسلط به ابزارهای کانتینرسازی Docker و ارکستراسیون با Kubernetes
• تجربه پیاده‌سازی پایپ‌لاین‌های CI/CD با GitLab CI یا GitHub Actions
• تجربه کانفیگ وب‌سرورهای Nginx

مزیت‌ها:
• آشنایی با Prometheus و Grafana برای مانیتورینگ سرویس‌ها ترجیحاً مدنظر است.
• تجربه کار با Ansible مزیت است.
حقوق: توافقی بر پایه سابقه کار`,
  },
];

export default function AnalyzerPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzedJob | null>(null);
  const [activeTab, setActiveTab] = useState("skills");
  const [copied, setCopied] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("jm_analyze_text");
      if (stored && stored.trim().length >= 40) {
        localStorage.removeItem("jm_analyze_text");
        setInputText(stored);
        handleAnalyze(stored);
      }
    }
  }, []);

  async function handleAnalyze(textToAnalyze?: string) {
    const text = (textToAnalyze ?? inputText).trim();
    if (!text) {
      setError("لطفاً متن آگهی شغلی را وارد کنید.");
      return;
    }
    if (text.length < 40) {
      setError("متن آگهی باید حداقل ۴۰ کاراکتر باشد تا اطلاعات کافی برای استخراج وجود داشته باشد.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await analyzeJob(text);
      if (response.error) {
        setError(response.error.message || "خطا در تحلیل آگهی شغلی.");
      } else if (response.job_analysis) {
        setResult(response.job_analysis);
        setError(null);
      } else {
        setError("پاسخی از سرویس تحلیلگر دریافت نشد.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطا در ارتباط با سرور.";
      setError(msg);
      toast.error("خطا در ارتباط با سرور تحلیلگر. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  function loadSample(sampleText: string) {
    setInputText(sampleText);
    setError(null);
    handleAnalyze(sampleText);
  }

  function copyJson() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  const isAuthed = typeof window !== "undefined" && !!getToken();

  return (
    <main className="flex-1 min-h-screen bg-gradient-to-b from-indigo-50/50 via-background to-slate-100/40 dark:from-slate-950 dark:via-background dark:to-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 py-3.5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">همراه کاریابی</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                  Job Analyzer
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                ایجنت تحلیل عمیق و راستی‌آزمایی شواهد آگهی
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/jobs")}
              className="text-xs"
            >
              <Briefcase className="size-3.5 ml-1 text-muted-foreground" />
              فرصت‌های شغلی
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold shadow-xs"
            >
              <Sparkles className="size-3.5 ml-1 text-indigo-500" />
              تحلیل هوشمند آگهی
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/resume")}
              className="text-xs"
            >
              <FileText className="size-3.5 ml-1 text-muted-foreground" />
              استودیوی رزومه
            </Button>
            {isAuthed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-muted-foreground mr-2"
              >
                خروج
              </Button>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 shadow-xs">
            <ShieldCheck className="size-3.5" />
            استخراج مبتنی بر شواهد متنی (Evidence-based Verification)
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            تحلیل هوشمند و تفکیک شواهد آگهی شغلی
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            متن آگهی استخدام را از جابینجا، لینکدین، کوئرا یا هر منبع دیگر وارد کنید.
            ایجنت مهارت‌های الزامی، مهارت‌های امتیازی، پشته فنی و شرایط سابقه را استخراج
            کرده و در برابر متن اصلی راستی‌آزمایی می‌کند.
          </p>
        </div>

        {/* Input Card */}
        <Card className="shadow-lg border-indigo-100/80 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label
                htmlFor="job-description-input"
                className="text-sm font-semibold flex items-center gap-2"
              >
                <FileText className="size-4 text-indigo-600" />
                متن کامل آگهی شغلی را اینجا جای‌گذاری (Paste) کنید:
              </label>

              {/* Sample Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground ml-1">آزمایش سریع با نمونه:</span>
                {SAMPLES.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => loadSample(s.text)}
                    className="text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 px-2.5 py-1 transition-all dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Textarea
                id="job-description-input"
                dir="auto"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="متن آگهی استخدامی شامل عنوان، مسئولیت‌ها، مهارت‌های لازم، پشته تکنولوژی و شرایط کاری را اینجا بچسبانید..."
                className="min-h-[160px] md:min-h-[190px] text-sm leading-relaxed p-4 font-sans border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
              />
              <div className="absolute left-3 bottom-3 flex items-center gap-2">
                {inputText.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInputText("")}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3 ml-1" />
                    پاک کردن
                  </Button>
                )}
                <span
                  className={
                    "text-xs px-2 py-0.5 rounded font-mono " +
                    (inputText.length >= 40
                      ? "text-muted-foreground"
                      : "text-amber-600 bg-amber-50 dark:bg-amber-950/40")
                  }
                >
                  {inputText.length} کاراکتر
                  {inputText.length > 0 && inputText.length < 40 && " (حداقل ۴۰)"}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>تحلیل ضد توهم با اعتبارسنجی ارجاع مستقیم به متن (Verbatim Quotes)</span>
              </div>

              <Button
                id="analyze-submit-button"
                onClick={() => handleAnalyze()}
                disabled={loading || inputText.trim().length === 0}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20 px-6 font-semibold"
              >
                {loading ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin ml-2" />
                    در حال تحلیل و راستی‌آزمایی…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 ml-2" />
                    شروع تحلیل هوشمند آگهی
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Area */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary Card */}
            <Card className="border-indigo-100 dark:border-slate-800 shadow-md overflow-hidden bg-gradient-to-br from-card via-card to-indigo-50/30 dark:to-slate-900/40">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-4 border-b pb-5 dark:border-slate-800">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                        {result.seniority
                          ? `سطح: ${result.seniority}`
                          : "سطح ارشدیت: عمومی"}
                      </span>
                      {result.employment_type && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {result.employment_type}
                        </span>
                      )}
                      {result.location && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">
                          <MapPin className="size-3 text-muted-foreground" />
                          {result.location}
                        </span>
                      )}
                      {result.provider && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          موتور: {result.provider}
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl md:text-2xl font-black text-foreground">
                      {result.title || "عنوان موقعیت شغلی"}
                    </h2>

                    {result.company && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="size-4 text-indigo-500" />
                        <span>{result.company}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyJson}
                      className="text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 ml-1 text-emerald-500" />
                          کپی شد!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5 ml-1 text-muted-foreground" />
                          کپی ساختار JSON
                        </>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push("/resume")}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      <FileText className="size-3.5 ml-1" />
                      استفاده در رزومه
                    </Button>
                  </div>
                </div>

                {/* Quick Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border bg-background/60 p-3 text-center space-y-1">
                    <div className="text-xs text-muted-foreground">مهارت‌های الزامی</div>
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {result.required_skills?.length || 0}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/60 p-3 text-center space-y-1">
                    <div className="text-xs text-muted-foreground">مهارت‌های مزیت / امتیازی</div>
                    <div className="text-2xl font-black text-violet-600 dark:text-violet-400">
                      {result.preferred_skills?.length || 0}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/60 p-3 text-center space-y-1">
                    <div className="text-xs text-muted-foreground">تکنولوژی و ابزارها</div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {(result.technologies?.length || 0) + (result.tools?.length || 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/60 p-3 text-center space-y-1">
                    <div className="text-xs text-muted-foreground">حداقل سابقه کار</div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {result.experience_requirements?.min_years
                        ? `${result.experience_requirements.min_years} سال`
                        : "نامشخص"}
                    </div>
                  </div>
                </div>

                {/* Warnings / Verification Banner */}
                {result.warnings && result.warnings.length > 0 ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="size-4" />
                      گزارش بازبینی شواهد (تعدیل یا تبدیل به استنباطی):
                    </div>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                      {result.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      راستی‌آزمایی شواهد تأیید شد: تمام مهارت‌ها و ادعاها مستقیماً با عبارات صریح داخل متن آگهی انطباق دارند.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full bg-muted/60 p-1">
                <TabsTrigger value="skills" className="text-xs font-semibold gap-1.5">
                  <Briefcase className="size-3.5" />
                  مهارت‌های تفکیک‌شده
                </TabsTrigger>
                <TabsTrigger value="stack" className="text-xs font-semibold gap-1.5">
                  <Cpu className="size-3.5" />
                  پشته فنی و ابزارها
                </TabsTrigger>
                <TabsTrigger value="requirements" className="text-xs font-semibold gap-1.5">
                  <GraduationCap className="size-3.5" />
                  شرایط، سابقه و حقوق
                </TabsTrigger>
                <TabsTrigger value="responsibilities" className="text-xs font-semibold gap-1.5">
                  <Layers className="size-3.5" />
                  مسئولیت‌ها
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Skills Breakdown */}
              <TabsContent value="skills" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Required Skills */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-rose-500" />
                        <h3 className="font-bold text-sm">
                          مهارت‌های الزامی (Required Skills)
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {result.required_skills?.length || 0} مورد
                      </Badge>
                    </div>

                    {result.required_skills && result.required_skills.length > 0 ? (
                      <div className="space-y-2.5">
                        {result.required_skills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border bg-card p-3 shadow-xs hover:border-indigo-200 transition-colors space-y-1.5 dark:border-slate-800 dark:hover:border-indigo-900"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {skill.name}
                              </span>
                              <Badge
                                variant={skill.explicit ? "success" : "warning"}
                                className="text-[10px]"
                              >
                                {skill.explicit ? "ذکر صریح در متن" : "استنباط شده"}
                              </Badge>
                            </div>

                            {skill.source_text && (
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-xs text-muted-foreground flex items-start gap-1.5">
                                <Quote className="size-3 text-indigo-500 shrink-0 mt-0.5" />
                                <span className="font-mono text-[11px] leading-relaxed">
                                  {skill.source_text}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                        مهارت الزامی خاصی در متن یافت نشد.
                      </div>
                    )}
                  </div>

                  {/* Preferred Skills */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-violet-500" />
                        <h3 className="font-bold text-sm">
                          مهارت‌های امتیازی و مزیت (Preferred Skills)
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {result.preferred_skills?.length || 0} مورد
                      </Badge>
                    </div>

                    {result.preferred_skills && result.preferred_skills.length > 0 ? (
                      <div className="space-y-2.5">
                        {result.preferred_skills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border bg-card p-3 shadow-xs hover:border-violet-200 transition-colors space-y-1.5 dark:border-slate-800 dark:hover:border-violet-900"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {skill.name}
                              </span>
                              <Badge
                                variant={skill.explicit ? "secondary" : "warning"}
                                className="text-[10px]"
                              >
                                {skill.explicit ? "پوئن مثبت" : "استنباطی"}
                              </Badge>
                            </div>

                            {skill.source_text && (
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-xs text-muted-foreground flex items-start gap-1.5">
                                <Quote className="size-3 text-violet-500 shrink-0 mt-0.5" />
                                <span className="font-mono text-[11px] leading-relaxed">
                                  {skill.source_text}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                        مهارت امتیازی یا اختیاری در متن ذکر نشده بود.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Tech Stack & Tools */}
              <TabsContent value="stack" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Technologies */}
                  <Card className="border-indigo-100 dark:border-slate-800">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Cpu className="size-4 text-indigo-600" />
                        <h3 className="font-bold text-sm">زبان‌ها و فریم‌ورک‌های استخراج‌شده</h3>
                      </div>
                      {result.technologies && result.technologies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.technologies.map((tech, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200/80 font-medium text-xs dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">تکنولوژی مجزایی تشخیص داده نشد.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tools */}
                  <Card className="border-indigo-100 dark:border-slate-800">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Wrench className="size-4 text-violet-600" />
                        <h3 className="font-bold text-sm">ابزارها و نرم‌افزارهای مورد نیاز</h3>
                      </div>
                      {result.tools && result.tools.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.tools.map((tool, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-800 border border-violet-200/80 font-medium text-xs dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">ابزار مجزایی در آگهی قید نشده بود.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 3: Requirements & Salary */}
              <TabsContent value="requirements" className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Experience */}
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Clock className="size-4 text-amber-500" />
                        <span>سابقه کار مورد نیاز</span>
                      </div>
                      <div className="text-xl font-extrabold text-foreground">
                        {result.experience_requirements?.min_years
                          ? `${result.experience_requirements.min_years} سال`
                          : "ذکر نشده"}
                        {result.experience_requirements?.max_years &&
                          ` تا ${result.experience_requirements.max_years} سال`}
                      </div>
                      {result.experience_requirements?.source_text && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-xs text-muted-foreground flex items-start gap-1">
                          <Quote className="size-3 text-amber-500 shrink-0 mt-0.5" />
                          <span>{result.experience_requirements.source_text}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Education */}
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <GraduationCap className="size-4 text-indigo-500" />
                        <span>تحصیلات و مدارک</span>
                      </div>
                      {result.education_requirements && result.education_requirements.length > 0 ? (
                        <div className="space-y-2">
                          {result.education_requirements.map((edu, idx) => (
                            <div key={idx} className="text-xs space-y-1">
                              <div className="font-semibold text-foreground">
                                {edu.level || "مدرک تحصیلی"} {edu.field && `— ${edu.field}`}
                              </div>
                              {edu.source_text && (
                                <p className="text-[11px] text-muted-foreground">
                                  «{edu.source_text}»
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">شرط مدرک خاصی در متن ذکر نشده است.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Salary */}
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Coins className="size-4 text-emerald-500" />
                        <span>حقوق و پاداش</span>
                      </div>
                      {result.salary ? (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">
                            {result.salary.min && result.salary.max
                              ? `${result.salary.min} تا ${result.salary.max} ${result.salary.currency || ""}`
                              : result.salary.source_text || "مشخص شده در متن"}
                          </div>
                          {result.salary.source_text && (
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-xs text-muted-foreground flex items-start gap-1">
                              <Quote className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{result.salary.source_text}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">حقوق در متن آگهی قید نشده بود.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 4: Responsibilities */}
              <TabsContent value="responsibilities" className="space-y-4">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Layers className="size-4 text-indigo-600" />
                      شرح وظایف و مسئولیت‌های استخراج‌شده از آگهی
                    </h3>

                    {result.responsibilities && result.responsibilities.length > 0 ? (
                      <ul className="space-y-2 text-sm text-foreground divide-y dark:divide-slate-800">
                        {result.responsibilities.map((resp, idx) => (
                          <li key={idx} className="pt-2 flex items-start gap-2.5">
                            <span className="size-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 dark:bg-indigo-900/50 dark:text-indigo-300">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{resp}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">لیست مسئولیت‌های مجزا در متن یافت نشد.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}
