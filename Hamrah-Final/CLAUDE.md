# CLAUDE.md — Agent 2: فرانت‌اند («همراه.exe»)

## وضعیت: آماده برای شروع

ایجنت ۲ (فرانت‌اند) فقط روی `FrontEnd/jobmatch-ui` کار می‌کند.
دو ایجنت دیگر موازی روی ویژگی‌های Backend (Agent 1) و Deployment (Agent 3) کار می‌کنند.

---

## ۱. سیستم توکن طراحی

### تصمیم رنگی
**انتخاب:** پالتِ **آبی/خاکستری** (تصویر ۴)
- این پالت بیشتر neutral و professional است
- تصویر ۳ (کرم/زرد) بیشتر سبک و معتدل است
- برای UI پیچیده‌تر و فنی‌تر، آبی/خاکستری بهتر کار می‌کند

### پالت رنگی نهایی
```css
/* Retro palette - Blue/Gray variant */
--color-bg-primary: #e8eef5;      /* خلفیهٔ پنجره - آبی روشن */
--color-bg-secondary: #d0d8e8;    /* خلفیهٔ secondary - آبی کمی تیره */
--color-border: #5a6a7a;          /* مرزهای پنجره - خاکستری */
--color-text-primary: #1a1a1a;    /* متن اصلی - سیاه */
--color-text-secondary: #4a4a4a;  /* متن فرعی - خاکستری */
--color-accent: #0066cc;          /* رنگ تأکید - آبی گرم */
--color-success: #006633;         /* موفقیت - سبز */
--color-warning: #cc6600;         /* اخطار - نارنجی */
--color-error: #cc0000;           /* خطا - قرمز */
```

### تایپوگرافی
- **فونت اصلی (فارسی):** `Courier New` یا `Monaco` (monospace برای حس retro)
- **فونت فنی (اصطلاحات انگلیسی):** `Courier New` (همان) - برای یکپارچگی
- **اندازه‌ها:**
  - Title: 18px bold
  - Body: 14px regular
  - Small: 12px regular
  - Label: 12px bold

### چیدمان
- **دسکتاپ:** دو ستون ثابت
  - چپ: فید آگهی‌ها (۶۰٪ عرض)
  - راست: پنل گفتگو (۴۰٪ عرض)
- **تبلت:** یک ستون عریض با تب‌ها
- **موبایل:** تب‌های فولدر
  - Tab 1: Jobs
  - Tab 2: Chat
  - Tab 3: Resume

---

## ۲. کامپوننت‌های Retro

### Design Principles
✅ **DO:**
- مربع‌های تیز با border‌های توپر
- خط‌کشی‌های dotted برای باکس‌های تأییدی
- اسکرول‌بارهای کلاسیک
- دکمه‌های مربعی با padding مشخص

❌ **DON'T:**
- گردی و سایه‌های soft
- گرادینت‌های نئونی
- Glassmorphism
- انیمیشن‌های floating

### کامپوننت‌های اساسی
1. **RetroWindow** - کامپوننت wrapper برای پنجره‌ی رترو
2. **RetroButton** - دکمه‌های مربعی
3. **RetroCard** - کارت‌های خط‌چین‌دار
4. **PercentageRing** - دایره‌های outline برای امتیازات
5. **ChecklistItem** - تیک/ضربدر مربعی

---

## ۳. صفحات/کامپوننت‌هایی برای ساخت

### Tier 1 (اولویت بالا)
- [ ] `components/retro/RetroWindow.tsx` - wrapper پنجره
- [ ] `components/retro/RetroButton.tsx` - دکمه
- [ ] `components/jobs/JobCard.tsx` - کارت آگهی با امتیاز
- [ ] `components/match/MatchDetail.tsx` - جزئیات تطبیق (حلقه‌ها + چک‌لیست)
- [ ] `lib/api.ts` - لایهٔ API یکپارچه

### Tier 2 (اولویت متوسط)
- [ ] `components/chat/ChatPanel.tsx` - پنل گفتگو
- [ ] `app/interview/page.tsx` - صفحهٔ شبیه‌ساز مصاحبه
- [ ] `components/interview/InterviewQuestion.tsx` - سوال + فیدبک

### Tier 3 (اولویت کم)
- [ ] `components/whatif/WhatIfSandbox.tsx` - sandbox What-If
- [ ] `app/resume/page.tsx` - صفحهٔ رزومه با نشان‌های وضعیت

---

## ۴. قرارداد API

### Endpoints برای هماهنگی با Agent 1

```
POST /api/interview/start/
{
  "job_id": string,
  "difficulty": "easy" | "medium" | "hard"
}
Response: { interview_id, questions: [...] }

POST /api/interview/answer/
{
  "interview_id": string,
  "question_index": number,
  "answer": string
}
Response: { feedback, score, next_question }

POST /api/career/what-if/
{
  "added_skills": [string],
  "removed_skills": [string]
}
Response: { matching_jobs_delta: number, new_opportunities: [...] }

POST /api/career/hidden-skill/confirm/
{
  "skill_name": string,
  "confidence": "high" | "medium" | "low"
}
Response: { acknowledged, updated_snapshot }

GET /api/resumes/{id}/truth-report/
Response: { claims: [...], verification_status: {...} }
```

### Mock Backend (فی‌الوقت)
- مسیر: `lib/mocks/`
- فلگ: `USE_MOCKS` در `lib/api.ts`
- بعد از آماده شدن Backend، فقط switch کن.

---

## ۵. وضعیت پیش‌نیازها

✅ shadcn/ui نصب شده
✅ TypeScript ready
✅ Tailwind CSS ready
⚠️ Design tokens ابھی نیاز به stylesheet
⚠️ Retro components ابھی ساخته نشده‌اند

---

## ۶. نقطهٔ شروع

1. ایجاد پالتِ رنگی در `tailwind.config.ts`
2. ایجاد `lib/design-tokens.ts` برای تمام ثابت‌های طراحی
3. ساخت کامپوننت‌های Retro پایه‌ای
4. مهاجرت صفحات موجود به retro style
5. ادغام API

---

## ۷. فایل‌های مستندات لازم

- [ ] `docs/design-references/` - ذخیرهٔ تصاویر ۱-۴
- [ ] `docs/DESIGN_DECISIONS.md` - تصمیمات طراحی و دلایل
- [ ] `docs/API_CONTRACTS_NEW_FEATURES.md` - قرارداد API (از Agent 1)
- [ ] `FrontEnd/jobmatch-ui/STORYBOOK.md` - نمایش کامپوننت‌های Retro

