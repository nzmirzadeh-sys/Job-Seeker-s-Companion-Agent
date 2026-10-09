# یادداشت ادغام (Merge Notes)

این نسخه حاصل ادغام `FrontEnd.zip` (دوستت) و `my_front.zip` (تو) طبق پلن بررسی‌شده است.
پایه از `my_front` (دیزاین سیستم رترو، API لایهٔ غنی‌تر، ویزارد رزومه، Docker امن‌تر) گرفته شده
و موارد زیر از `FrontEnd` به آن منتقل/ادغام شده‌اند.

## کارهایی که انجام شد
1. **`lib/api.ts`**: توابع `register`/`login` و مدیریت خطای ۴۰۱ از نسخهٔ FrontEnd به داخل
   `fetchAPI` نسخهٔ my_front اضافه شد؛ تایپ `Profile` با فیلدهای کامل (target_role, city,
   skills, level, experience_years...) تکمیل شد؛ تایپ‌ها و تابع `analyzeJob` برای صفحهٔ آنالایزر
   اضافه شدند. بقیهٔ تایپ‌ها و mock‌های غنی my_front دست‌نخورده ماندند.
2. **`app/analyzer/page.tsx`**: کامل از FrontEnd منتقل شد (مستقل است، تداخلی با چیزی نداشت).
3. **`app/onboarding/page.tsx`**: نسخهٔ کامل‌تر FrontEnd (با سایدبار پیشرفت پروفایل، badge
   مهارت‌ها، چیپ‌های پیشنهادی پویا) جایگزین نسخهٔ my_front شد — چون my_front چیزی اضافه بر این
   نداشت و این نسخه هر دو قابلیت را دارد.
4. **`app/login/page.tsx`**: ظاهر رترو my_front حفظ شد، ولی منطق داخلش به‌جای `fetch` مستقیم،
   از `register`/`login` در `lib/api.ts` استفاده می‌کند (هماهنگ با بقیهٔ اپ).
5. **`sonner` (toast)**: به `package.json` و `app/layout.tsx` اضافه شد.
6. **`Dockerfile`**: هاردنینگ امنیتی my_front (non-root user) حفظ شد، ولی باگ
   `npm ci --only=production` فیکس شد (حالا `npm ci` کامل با devDependencies اجرا می‌شود چون
   استیج builder به typescript/tailwindcss نیاز دارد).
7. **`next.config.ts`**: بلاک نامعتبر `i18n` (فقط برای Pages Router) حذف شد؛ هدرهای امنیتی و
   `optimizePackageImports` باقی ماندند.
8. **`AGENTS.md` / `CLAUDE.md`**: از FrontEnd کپی شدند (فقط فایل راهنمای AI، بی‌ضرر).

✅ کل پروژه با `next build` تست شد و بدون خطای TypeScript یا بیلد، تمام ۱۱ روت ساخته شدند.

## به‌روزرسانی: هماهنگی با `nginx.conf` و `docker-compose.yml`

بعد از دیدن این دو فایل از ریپوی دوستت، دو ناسازگاری واقعی پیدا و فیکس شد:

1. **اسم env var اشتباه بود**: `docker-compose.yml` موقع build فرانت‌اند این رو پاس می‌ده:
   `args: NEXT_PUBLIC_API_BASE: /api` — ولی `lib/api.ts` (که پایه‌ش my_front بود) داشت
   `NEXT_PUBLIC_API_URL` رو می‌خوند. در production مقدار `/api` هیچ‌وقت به کد نمی‌رسید و
   فرانت‌اند می‌افتاد روی `http://localhost:8000/api` که پشت nginx جواب نمی‌ده (CORS/connection
   از مرورگر کاربر به backend مستقیم). الان `lib/api.ts` روی `NEXT_PUBLIC_API_BASE` خونده می‌شه.
2. **`Dockerfile` اصلاً `ARG` لازم رو نداشت**: چون متغیرهای `NEXT_PUBLIC_*` توی Next.js فقط موقع
   build می‌رن داخل باندل (نه runtime)، باید قبل از `npm run build` با `ARG`+`ENV` تعریف بشن تا
   مقداری که docker-compose پاس می‌ده واقعاً اثر کنه. این بلاک به Dockerfile اضافه شد (الگوش از
   Dockerfile نسخهٔ FrontEnd گرفته شد، که این مشکل رو نداشت).

نکتهٔ جانبی (خارج از اسکوپ فرانت‌اند، نیاز به بررسی سمت بک‌اند): هم `docker-compose.yml` و هم
`nginx.conf` روی مسیر `backend:8000/api/health/` healthcheck می‌زنن — مطمئن شو این روت توی
Django واقعاً وجود داره، چون این دو زیپ فرانت‌اندی که ادغام کردم هیچ اطلاعی از بک‌اند نداشت.

## کارهایی که عمداً انجام **نشد** (نیاز به تصمیم یا کار دستی بیشتر دارند)

- **`app/jobs/[id]/page.tsx`**: منتقل نشد. این صفحه در FrontEnd از تایپ `MatchRow` قدیمی
  (`{id, job: Job, score, breakdown, reasons, missing_skills, status}`) استفاده می‌کند که با
  شکل تایپ `MatchRow` در my_front (`{job: MatchRowJob, score, reasons?, missing_skills?,
  breakdown?}` — بدون `id` و `status`) فرق اساسی دارد. my_front این قابلیت را با یک **مدال
  جزئیات داخل `/jobs`** جایگزین کرده. طبق همون گزینه‌ای که گزارش مقایسه هم مطرح کرده بود
  («یا تصمیم بگیر مدال B کافیه») فعلاً همون مدال نگه داشته شده. اگر صفحهٔ جداگانه را می‌خوای،
  باید یا تایپ `MatchRow` یکسان‌سازی شود یا صفحه بازنویسی شود روی API جدید.
- **ادغام ویرایشگر رزومهٔ FrontEnd داخل `Step3Review` ویزارد my_front** (آیتم ۷ گزارش): این یک
  بازنویسی منطقی واقعی می‌خواد (نه کپی فایل)، چون منطق ویرایش FrontEnd روی `ResumeContent` قدیمی
  نوشته شده و باید با state ویزارد هماهنگ شود. فعلاً صفحهٔ «گزارش صحت» my_front به همون شکل باقی
  مانده. این را می‌تونم جدا در یک پاس بعدی روی `Step3Review.tsx` انجام بدم.
- **صفحات placeholder (`guide`, `interview`, `settings`)**: دست‌نخورده باقی ماندند. طبق گزارش،
  `startInterview`/`answerInterviewQuestion` از قبل در `lib/api.ts` آماده‌اند ولی هیچ UI به آن‌ها
  وصل نیست — این هنوز باز کار باقی‌مانده است.
