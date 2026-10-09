# اصلاح Endpoint های رزومه + ساخت ویزارد رزومه تصویر ۵ — پیاده‌سازی

## پژوهش مخزن: نتایج کلیدی

### ۱. Endpoint های واقعی رزومه (در مقابل فرض اشتباه قبلی)

**پیشینه اشتباه قبلی:** `resume/page.tsx` حالا به `/resumes/me/truth-report/` درخواست می‌فرستد و فرض می‌کند پاسخ شکل `{truth_report: {overall_verification_percentage, items[]}}` دارد — که **هیچ‌کدام درست نیستند**.

**endpoint های واقعی (`apps/resumes/urls.py` + `views.py`):**
| متد | URL | توضیح |
|-----|-----|-------|
| GET/POST | `/api/resumes/` | لیست رزومه‌های کاربر یا ساخت رزومه جدید |
| GET/PATCH/DELETE | `/api/resumes/<id>/` | جزئیات/ویرایش/حذف یک رزومه |
| GET | `/api/resumes/<id>/pdf/` | خروجی PDF یا HTML |
| GET | `/api/resumes/<id>/truth-report/` | **گزارش حقیقت** (نه `/resumes/me/...`) |

**زنجیره صحیح برای گرفتن truth-report:**
1. ابتدا `GET /api/resumes/` → لیست را بگیر، ردیفی که `active === true` است پیدا کن و `id` آن را استخراج کن
2. سپس `GET /api/resumes/<active_id>/truth-report/`

**شکل واقعی پاسخ Truth Report (از `truth_guard.py#L140-L146` + `views.py#L87-L94`):**
```json
{
  "resume_id": 7,
  "truth_report": [
    {
      "claim_text": "37%",
      "claim_type": "percentage" | "quantitative",
      "status": "verified" | "unsupported" | "needs_clarification",
      "evidence_ref": {type, skill_name?, evidence?} | null,
      "suggestion": "...",
      "context": "عنوان تجربه یا بخش"
    }, ...
  ],
  "overall_truth_score": 0.72,
  "verified_claims": 8,
  "unsupported_claims": 3,
  "needs_clarification_claims": 2
}
```

**نکات:**
- فیلد اشتباه قبلی `overall_verification_percentage` → **واقعاً اسمش `overall_truth_score`** و مقدارش عدد اعشاری ۰ تا ۱ است (نه درصد ۰-۱۰۰)
- آرایه `items[]` → اسم واقعی `truth_report[]` است
- فیلدهای `section/claim/explanation` → نام واقعی `context/claim_text/suggestion`
- سه‌حالتی درست: `verified / unsupported / needs_clarification` (نه `missing_evidence`)

### ۲. Endpoint های Match و فیلدهای واقعی MatchResult

**endpoint واقعی:** `POST /api/match/analyze/` ✅ درست حدس زده شده بود. پاسخ در کلید `match_result` قرار می‌گیرد.

**شکل واقعی MatchResult (از `core/match_schemas.py#L49-L69`):**
```
FitDimensions:  تا فیلدها همگی وجود دارند:
  ✓ technical_fit, experience_fit, education_fit  (امروز در صفحه رندر می‌شوند)
  ✓ career_goal_fit, preference_fit, constraint_fit  (وجود دارند ولی رندر نمی‌شوند)

Skill fields:
  ✓ matching_skills: string[]          (رندر شده)
  ✓ missing_required_skills: string[]  (رندر شده)
  ✓ missing_preferred_skills: string[] (وجود دارد ولی رندر نمی‌شود)
  ✓ uncertain_matches: string[]        (وجود دارد ولی رندر نمی‌شود)
  ✓ skill_matches: SkillMatchDetail[]  (دیتای شرحی تک‌تک مهارت‌ها)
  ✓ constraints: ConstraintEvaluation[] (شرایط سخت/نرم)
  ✓ strengths, gaps, risks: string[]   (وجود دارند، رندر نمی‌شوند)
  ✓ reasoning, recommendation: str     (وجود دارند)
```

**نتیجه گیری برای jobs/page.tsx:**
- هیچ‌کدام از فیلدهای فرضی در reality ندارند. ۶ FitDimension تماماً وجود دارند.
- ولی دو مورد مهم **نشان داده نمی‌شوند** ولی باید نشان داده شوند:
  1. `missing_preferred_skills` (Badge های نارنجی/زرد)
  2. `uncertain_matches` (Badge های زرد/نامشخص)
- سه فیلد `career_goal_fit / preference_fit / constraint_fit` هم در schema هستن و می‌توان به لیست «ابعاد تناسب» اضافه کرد (در حال حاضر فقط ۳ تا ۶ تایش رندر می‌شوند).

### ۳. Endpoint های لازم برای ویزارد رزومه (همگی آماده)

| What | URL | Shape |
|------|-----|-------|
| Gap Priority (مرحله ۱) | `GET /api/career/gap-priority/` | `{prioritized_gaps: [{skill, jobs_unlocked, jobs_mentioning, impact_score, sample_job_titles, sample_jobs[], score_gain}, ...]}` |
| تحلیل Match کامل | `POST /api/match/analyze/` | همان MatchResult بالا |
| گرفتن Career Memory | `GET /api/career/memory/` | Snapshot کامل مهارت‌ها/تجربیات |
| **ساخت رزومه جدید** (مرحله ۳) | `POST /api/resumes/` body: `{title?, content?}` | `{id, version, title, content, active, created_at, updated_at}` |
| **ویرایش رزومه** (مرحله ۳) | `PATCH /api/resumes/<id>/` body: `{title?, content?, active?}` | همان شکل بالا |
| گزارش حقیقت پیش‌نمایش نهایی | `GET /api/resumes/<id>/truth-report/` | همان شکل Task 1 |

**شکل واقعی محتوای رزومه (از `agent/tools.py#L91-L109`):**
```ts
interface ResumeContent {
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  skills: { name: string }[];
  experiences: { title: string; company: string; start?: string; end?: string; description: string }[];
  projects: { name: string; description: string; link?: string }[];
  educations: { degree: string; school: string; start?: string; end?: string }[];
  languages: { name: string; level: string }[];
  links: string[];
}
```

### ۴. مشکلات موجود در api.ts (باید تعمیر شوند تا build بگذرد)

`jobs/page.tsx` و `resume/page.tsx` مواردی را import می‌کنند که در `lib/api.ts` **export نیستند:**
- `api` → باید `fetchAPI` با نام مستعار `api` هم export شود
- `getToken` → تابعی برای خواندن `auth_token` از localStorage
- `streamChat` → SSE stream برای چت (در حال حاضر وجود ندارد، باید skeleton بسازیم یا در صورت نبود mock کنیم)
- `MatchDecisionResult` → تایپ کامل MatchResult
- `MatchRow` → تایپ مورد نیاز برای فید آگهی‌ها (شامل `{job, score, reasons?, breakdown?, missing_skills?}`)

همچنین در حال حاضر RetroWindow تایپش شامل `menu` و `contentClassName` نیست ولی هر دو صفحه این‌ها را پاس می‌دهند → باید props اضافه شوند.

---

## فایل‌ها و ماژول‌های تغییرنیافته/ساخته‌شده

### فایل‌های ویرایش‌شده:
1. `FrontEnd/jobmatch-ui/lib/api.ts` — اضافه کردن export های گمشده، تعمیر تایپ‌ها، اضافه کردن endpoint های جدید
2. `FrontEnd/jobmatch-ui/components/retro/RetroWindow.tsx` — اضافه کردن `menu` و `contentClassName` props
3. `FrontEnd/jobmatch-ui/app/resume/page.tsx` — تعمیر کامل endpoint truth-report + شکل واقعی داده‌ها
4. `FrontEnd/jobmatch-ui/app/jobs/page.tsx` — اضافه کردن missing_preferred_skills، uncertain_matches، و کامل کردن ۶ FitDimension

### فایل‌های جدید:
5. `FrontEnd/jobmatch-ui/app/resume-wizard/page.tsx` — **ویزارد ۳مرحله‌ای رزومه** (تصویر ۵)

---

## مراحل پیاده‌سازی (به ترتیب وابستگی)

### مرحله الف: تعمیرات زیرساختی (prerequisites)

**قدم ۱ — تعمیر RetroWindow**
- به interface `RetroWindowProps` دو prop اضافه کن: `menu?: {title: string}[]` و `contentClassName?: string`
- `menu` را بالای content در یک نوار دکمه‌های ابزار (retro menubar) رندر کن
- `contentClassName` را به کلاس‌های درون‌مایه content اضافه کن

**قدم ۲ — تعمیر کامل lib/api.ts**
- `fetchAPI` را با نام مستعار `api` هم export کن
- `getToken(): string | null` اضافه کن
- `streamChat` را به‌صورت skeleton اضافه کن (که build خطا ندهد — خروجی SSE را mock کند)
- تایپ `MatchDecisionResult` را مطابق `MatchResult` واقعی در schema کامل بنویس (شامل ۶ FitDimension، تمام فیلدهای skills، constraints و غیره)
- تایپ `MatchRow` شامل `{job: {id, title, company, city, description?, ...}, score: number, reasons?: string[], breakdown?: {skills, role, level, logistics}, missing_skills?: string[]}`
- تایپ `TruthReport` را مطابق شکل واقعی بالا بازنویسی کن (claim_text/status/suggestion و نه section/explanation، و `overall_truth_score` اعشاری)
- تابع `listResumes()` برای GET `/api/resumes/` اضافه کن
- تابع `createResume(content?), updateResume(id, patch)` برای POST/PATCH اضافه کن
- تابع `getGapPriority()` برای GET `/api/career/gap-priority/` با تایپ صحیح `PrioritizedGap[]` اضافه کن
- تابع `getCareerMemory()` برای GET `/api/career/memory/` اضافه کن
- `analyzeMatch` return تایپش را درست کن → واقعاً `{match_result: MatchDecisionResult, job_source: string}` برمی‌گرداند

### مرحله ب: کار ۱ — اصلاح صفحه resume با endpoint واقعی

**قدم ۳ — بازنویسی منطق بارگذاری resume/page.tsx**
- در `loadReport`: اول `listResumes()` را صدا می‌زند، لیست را می‌گیرد، رزومهٔ فعال (active=true) را پیدا می‌کند
- اگر رزومهٔ فعال وجود نداشت، پیام «هنوز رزومه ساخته نشده» نشان بده و دکمه‌ای برای رفتن به wizard بگذار
- با `id` رزومهٔ فعال، `getTruthReport(id)` را فراخوانی کن
- پاسخ واقعی را به درستی map کن:
  - `overall_truth_score` (اعشاری ۰.۷۲) را به درصد ۷۲ تبدیل کن تا در UI نمایش درست پیدا کند
  - آرایه `truth_report` را به‌عنوان آیتم‌های لیست نشان بده
  - هر آیتم: `claim_text` به عنوان ادعا، `context` به عنوان بخش، `suggestion` به عنوان توضیح
  - Status ها: `verified` → سبز، `unsupported` → قرمز، `needs_clarification` → نارنجی
- سه کادر آمار: `verified_claims / unsupported_claims / needs_clarification_claims`

### مرحله ج: کار ۲ — تکمیل و اصلاح صفحه jobs

**قدم ۴ — اصلاح Match Decision view در jobs/page.tsx**
- در بخش «ابعاد تناسب»، ۳ فیلد فعلی نگه داشته و ۳ تای دیگر را هم اضافه کن:
  - `career_goal_fit` با لیبل «هدف شغلی»
  - `preference_fit` با لیبل «ترجیحات»
  - `constraint_fit` با لیبل «محدودیت‌ها»
- بعد از `missing_required_skills`، بخش جدیدی برای `missing_preferred_skills` اضافه کن (Badge های نارنجی با ⚠)
- بعد از آن، بخشی برای `uncertain_matches` اضافه کن (Badge های خاکستری با `?`)
- همه حلقه‌ها را با شرط `.length > 0` محافظت کن (چیزی که در پاسخ نیست رندر نشود)

### مرحله د: کار ۳ — ساخت ویزارد رزومه ۳مرحله‌ای (تصویر ۵)

**قدم ۵ — ساخت صفحه `app/resume-wizard/page.tsx`**

ویزارد سه مرحله با stepper افقی در بالای پنجره retro:

**مرحله ۱: «تفاوت‌ها / مقایسهٔ آگهی با رزومه فعلی»**
- `getGapPriority()` فراخوانی شود → لیست مهارت‌های گمشده با اولویت
- از فید کاربر یک آگهی انتخابی فعلی (یا بالاترین اسکور) برای match analyze استفاده کن (کاربر از لیست انتخاب کند یا به‌صورت پیش‌فرض بهترین آگهی)
- یک جدول دو ستونه بساز: ستون چپ «در آگهی» / ستون راست «در رزومهٔ تو»
- هر ردیف شامل: **عنوان + نقطهٔ سبز ✓ / قرمز ✕ (کدر)**
- ردیف‌ها شامل:
  ۱. همه مهارت‌های `prioritized_gaps` (از Gap Priority) → همه ✕ در ستون رزومه
  ۲. `missing_required_skills` و `missing_preferred_skills` از Match
  ۳. اگر `experience_fit.status === 'conflict'` → سابقه ✕
  ۴. اگر `education_fit.status === 'conflict'` → تحصیلات ✕
  ۵. constraint هایی که status شان `violated` است
- زیر هر ردیف توضیح کوتاه (`explanation` از FitDimension یا `impact_score` از Gap)

**مرحله ۲: «هم‌راستاسازی / تأیید و تکمیل»**
- فقط مواردی که در مرحله ۱ دارای ✕ بودند را نشان بده
- برای هر مورد، **کادر با مرز خط‌چین (dashed border)** (مثل retro card با dotted/dashed)
- داخل هر کادر:
  - عنوان مورد (مثلاً "مهارت SQL")
  - یک textarea/input درخواست توضیح یا مدرک از کاربر
  - دکمه‌های «تأیید و اضافه کن» / «رد کن»
  - هشدار: «این مورد تا وقتی توضیح/مدرک ندی به رزومه اضافه نمی‌شود»
- از کاربر قبل از رفتن به مرحله ۳ حداقل یکبار همه موارد را تیک‌خورده یا رد کرده باشد

**مرحله ۳: «بازبینی / پیش‌نمایش نهایی»**
- با استفاده از موارد تأییدشده مرحله ۲، یک `ResumeContent` بساز (skills جدید اضافه شوند، توضیحات در summary یا experiences جای بگیرند)
- اگر کاربر رزومه فعال دارد: `updateResume(id, {content: newContent})`، در غیر این صورت: `createResume(newContent)`
- بعد از ذخیره، خروجی رزومه را در قالب پیش‌نمایش یک‌صفحه‌ای نشان بده (نام / عنوان / خلاصه / مهارت‌ها / تجربیات و ...)
- زیر پیش‌نمایش: نمایش خلاصه گزارش حقیقت (با تابع `getTruthReport`) — چند ادعای تأیید/بدون‌مدرک
- دکمه‌های نهایی: «تأیید و دانلود PDF» (به `GET /api/resumes/<id>/pdf/` لینک شود) و «بازگشت به خانه»

---

## وابستگی‌ها و ملاحظات

- **RTL و زبان فارسی:** تمام UI فارسی و RTL است، راست‌چین بودن فرم‌ها و جداول حفظ شود
- **پالت رنگی:** همان پالت فعلی کرم/زرد که در دو صفحه دیگر استفاده شده (#FBF7EC / #F2C230 / #141311 / #3B7A4A / #B23A2E / #C98A1F)
- **Consistency ظاهری:** کامپوننت‌های RetroWindow، RetroButton، ChecklistItem دقیقاً همان‌طور که در `jobs` و `resume` استفاده شده استفاده شوند
- **Type strictness:** تمام interface ها دقیقاً مطابق Backend باشند تا هرگونه ناسازگاری در compile (build) متوجه شود
- **localStorage token:** در تابع `fetchAPI` حالا از localStorage می‌خواند — همین روش ادامه پیدا کند
- **NEXT_PUBLIC_USE_MOCKS=true fallback:** همه تابع‌های جدید هم دارایی mock داشته باشند تا در صورت نبود Backend UI خراب نشود

---

## اعتبارسنجی پس از پیاده‌سازی

1. در پوشهٔ `FrontEnd/jobmatch-ui/` اجرا کن: `npm run build`
2. مطمئن شو هیچ خطای TypeScript و build وجود ندارد (خطاهای `does not exist on type`، `missing props` و غیره)
3. چک کن تگ‌های `<a>` بدون فرض endpoint اشتباه (یعنی `/resumes/me/...` در کد باقی نمانده باشد)
4. بررسی تطابق: `MatchDecisionResult` → فیلدهای حذف‌نشده‌اند و فقط فیلدهای واقعی render می‌شوند (رender شرطی با `.length > 0`)

---

## ریسک‌ها و راه حل‌ها

- **ریسک ۱: کاربر رزومهٔ فعال نداشته باشد** → حل: در صفحهٔ resume دکمه رفتن به wizard نشان داده شود و در wizard ابتدا با `createResume` رزومه خالی بسازد
- **ریسک ۲: gap_priority به‌صورت موقتی خالی برگردد** → پیام «تا حالا آگهی کافی برای تحلیل شکاف در پروفایل شما ثبت نشده» نمایش داده شود؛ کاربر بتواند بدون gap ها هم ادامه دهد
- **ریسک ۳: streamChat هنوز backend ندارد** → حل: skeleton آن فقط یک Promise.resolve که callback را یکبار با متن پیش‌فرض صدا می‌زند تا TypeScript خطا ندهد؛ در آینده واقعاً پیاده می‌شود
- **ریسک ۴: RetroWindow قبلاً بدون menu پیاده شده بود** → حل: menu کاملاً اختیاری است؛ اگر پاس داده نشود، همان behaviour قبلی حفظ می‌شود
