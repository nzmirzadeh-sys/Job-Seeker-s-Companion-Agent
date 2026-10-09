"""Seed demo data: a demo user + realistic Persian job postings."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import Profile
from apps.jobs.models import JobPosting

User = get_user_model()

JOBS = [
    # --- intern / junior frontend (demo persona focus) ---
    {"title": "کارآموز فرانت‌اند", "company": "کافه‌بازار", "city": "تهران", "level": "intern",
     "required_skills": ["HTML", "CSS", "JavaScript"], "optional_skills": ["React"],
     "job_types": ["onsite"], "salary_min": 8000000, "salary_max": 12000000,
     "description": "کارآموزی فرانت‌اند در تیم محصول کافه‌بازار؛ آشنایی با مبانی وب و علاقه به ری‌اکت."},
    {"title": "توسعه‌دهنده جونیور Frontend", "company": "دیجی‌کالا", "city": "تهران", "level": "junior",
     "required_skills": ["React", "JavaScript", "CSS"], "optional_skills": ["TypeScript", "Next.js"],
     "job_types": ["onsite", "hybrid"], "salary_min": 25000000, "salary_max": 35000000,
     "description": "توسعه رابط کاربری فروشگاه اینترنتی با React و طراحی کامپوننت‌محور."},
    {"title": "Frontend Developer (Vue)", "company": "زهراوی", "city": "مشهد", "level": "junior",
     "required_skills": ["Vue", "JavaScript", "HTML"], "optional_skills": ["Nuxt"],
     "job_types": ["onsite"], "description": "توسعه پنل مدیریت با Vue.js و کار تیمی روزانه."},
    {"title": "React Developer", "company": "تراشه", "city": "تهران", "level": "mid",
     "required_skills": ["React", "TypeScript", "Redux"], "optional_skills": ["Testing", "Jest"],
     "job_types": ["hybrid"], "salary_min": 40000000, "salary_max": 60000000,
     "description": "توسعه داشبوردهای تحلیلی با React و TypeScript؛ تجربه کار با REST API الزامی است."},
    {"title": "Next.js Developer", "company": "اسنپ", "city": "تهران", "level": "mid",
     "required_skills": ["Next.js", "React", "TypeScript"], "optional_skills": ["GraphQL", "SSR"],
     "job_types": ["remote", "hybrid"], "salary_min": 50000000, "salary_max": 80000000,
     "description": "توسعه صفحات سرویس‌های شهری با Next.js و رندر سمت سرور."},
    {"title": "کارآموز Frontend (دورکاری)", "company": "بازارجاب", "city": "دورکاری", "level": "intern",
     "required_skills": ["HTML", "CSS", "JavaScript"], "optional_skills": ["Git"],
     "job_types": ["remote"], "description": "کارآموزی تمام‌دورکاری؛ تیم مهندسی پشتیبان شما خواهد بود."},
    {"title": "Frontend Engineer", "company": "Cafe Bazaar Intl", "city": "دورکاری", "level": "senior",
     "required_skills": ["React", "TypeScript", "Testing", "CI/CD"], "optional_skills": ["Node.js"],
     "job_types": ["remote"], "salary_min": 90000000, "salary_max": 140000000,
     "description": "Lead frontend features across multiple products; strong TS + testing culture."},
    {"title": "توسعه‌دهنده وب (HTML/CSS)", "company": "استودیو گراف", "city": "اصفهان", "level": "junior",
     "required_skills": ["HTML", "CSS", "WordPress"], "optional_skills": ["JavaScript"],
     "job_types": ["onsite"], "description": "پیاده‌سازی قالب‌های وردپرس و لندینگ‌پیج‌های شرکتی."},
    {"title": "UI Developer", "company": "همکاران سیستم", "city": "تهران", "level": "junior",
     "required_skills": ["HTML", "CSS", "JavaScript", "jQuery"], "optional_skills": ["Bootstrap"],
     "job_types": ["onsite"], "salary_min": 20000000, "salary_max": 30000000,
     "description": "پیاده‌سازی رابط کاربری سیستم‌های سازمانی با استانداردهای W3C."},
    {"title": "کارشناس فرانت‌اند", "company": "آپ", "city": "تهران", "level": "junior",
     "required_skills": ["React", "CSS", "Git"], "optional_skills": ["Figma", "Storybook"],
     "job_types": ["hybrid"], "salary_min": 28000000, "salary_max": 40000000,
     "description": "همکاری با تیم دیزاین برای پیاده‌سازی دیزاین‌سیستم بانکی."},
    # --- backend / fullstack (should score lower for a frontend persona) ---
    {"title": "توسعه‌دهنده بک‌اند (Python/Django)", "company": "فناوران همتا", "city": "تهران", "level": "junior",
     "required_skills": ["Python", "Django", "PostgreSQL"], "optional_skills": ["Docker", "REST API"],
     "job_types": ["onsite"], "salary_min": 25000000, "salary_max": 40000000,
     "description": "توسعه سرویس‌های بک‌اند با Django و DRF؛ آشنایی با داکر امتیاز است."},
    {"title": "Fullstack Developer (Node+React)", "company": "ایده‌پردازان", "city": "تهران", "level": "mid",
     "required_skills": ["Node.js", "React", "MongoDB"], "optional_skills": ["AWS"],
     "job_types": ["hybrid"], "description": "توسعه اپلیکیشن‌های SaaS از دیتابیس تا UI."},
    {"title": "Android Developer", "company": "بله", "city": "تهران", "level": "junior",
     "required_skills": ["Kotlin", "Android SDK"], "optional_skills": ["Jetpack Compose"],
     "job_types": ["onsite"], "description": "توسعه اپ پیام‌رسان بله با کاتلین."},
    {"title": "Data Analyst", "company": "مگاپیکسل", "city": "تهران", "level": "mid",
     "required_skills": ["SQL", "Python", "Power BI"], "optional_skills": ["Excel"],
     "job_types": ["onsite"], "description": "تحلیل داده‌های رفتاری کاربران و ساخت داشبورد مدیریتی."},
    {"title": "DevOps Engineer", "company": "زرین‌پال", "city": "تهران", "level": "senior",
     "required_skills": ["Docker", "Kubernetes", "Linux"], "optional_skills": ["Terraform"],
     "job_types": ["hybrid"], "description": "مدیریت زیرساخت پرداخت با K8s و مانیتورینگ."},
    {"title": "توسعه‌دهنده PHP (Laravel)", "company": "وب‌گستر", "city": "شیراز", "level": "junior",
     "required_skills": ["PHP", "Laravel", "MySQL"], "optional_skills": ["Vue"],
     "job_types": ["onsite"], "description": "توسعه وب‌سایت‌های سازمانی با لاراول."},
    # --- support / sales / unrelated ---
    {"title": "کارشناس پشتیبانی فنی", "company": "آسا‌سرویس", "city": "تهران", "level": "junior",
     "required_skills": ["Communication", "CRM"], "optional_skills": ["HTML"],
     "job_types": ["onsite"], "description": "پاسخگویی به مشتریان سازمانی و ثبت تیکت‌ها."},
    {"title": "کارشناس فروش", "company": "نت‌برگ", "city": "تهران", "level": "junior",
     "required_skills": ["Sales", "Negotiation"], "optional_skills": [],
     "job_types": ["onsite"], "description": "فروش خدمات ابری به کسب‌وکارها."},
    {"title": "منابع انسانی", "company": "توسعه گستر", "city": "کرج", "level": "mid",
     "required_skills": ["HR", "Recruiting"], "optional_skills": [],
     "job_types": ["onsite"], "description": "جذب و نگهداشت استعدادهای فنی."},
    {"title": "تولید محتوا", "company": "پین‌ترست فارسی", "city": "دورکاری", "level": "junior",
     "required_skills": ["Copywriting", "SEO"], "optional_skills": ["WordPress"],
     "job_types": ["remote"], "description": "تولید محتوای سئو شده برای وبلاگ."},
    # --- more frontend variety (different cities / remote) ---
    {"title": "Frontend Developer", "company": "تجربه", "city": "تبریز", "level": "junior",
     "required_skills": ["JavaScript", "CSS", "HTML"], "optional_skills": ["React"],
     "job_types": ["onsite"], "description": "توسعه فروشگاه آنلاین با تمرکز بر تجربه کاربری."},
    {"title": "کارشناس فرانت‌اند (ری‌اکت)", "company": "فرادرس", "city": "تهران", "level": "mid",
     "required_skills": ["React", "TypeScript", "Sass"], "optional_skills": ["Next.js"],
     "job_types": ["hybrid"], "salary_min": 35000000, "salary_max": 55000000,
     "description": "توسعه پلتفرم آموزش آنلاین با ری‌اکت و تست خودکار."},
    {"title": "Remote Frontend Intern", "company": "GlobalSoft", "city": "دورکاری", "level": "intern",
     "required_skills": ["JavaScript", "React"], "optional_skills": ["CSS", "English"],
     "job_types": ["remote"], "description": "Paid remote internship for junior frontend developers."},
    {"title": "Angular Developer", "company": "سیستم‌های هوشمند", "city": "تهران", "level": "mid",
     "required_skills": ["Angular", "TypeScript", "RxJS"], "optional_skills": ["NX"],
     "job_types": ["onsite"], "description": "توسعه نرم‌افزارهای سازمانی با Angular."},
    {"title": "کارآموز توسعه وب", "company": "مدرسه وب", "city": "تهران", "level": "intern",
     "required_skills": ["HTML", "CSS"], "optional_skills": ["JavaScript", "Figma"],
     "job_types": ["onsite"], "description": "کارآموزی وب برای علاقه‌مندان به مسیر فرانت‌اند."},
    {"title": "React Native Developer", "company": "دوپینگ", "city": "تهران", "level": "mid",
     "required_skills": ["React Native", "JavaScript"], "optional_skills": ["iOS", "Android"],
     "job_types": ["hybrid"], "description": "توسعه اپلیکیشن موبایل فروشگاهی با React Native."},
    {"title": "Webflow/No-code Developer", "company": "استارتاپ محور", "city": "دورکاری", "level": "junior",
     "required_skills": ["Webflow", "CSS"], "optional_skills": ["JavaScript"],
     "job_types": ["remote"], "description": "ساخت لندینگ‌پیج‌های سریع با ابزارهای No-code."},
    {"title": "Frontend Lead", "company": "کوانت", "city": "تهران", "level": "senior",
     "required_skills": ["React", "TypeScript", "Architecture"], "optional_skills": ["GraphQL", "Team Lead"],
     "job_types": ["onsite"], "salary_min": 80000000, "salary_max": 120000000,
     "description": "رهبری تیم فرانت‌اند و طراحی معماری دیزاین‌سیستم."},
]


class Command(BaseCommand):
    help = "Seed demo user and job postings for the hackathon demo."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(username="demo")
        if created:
            user.set_password("demo1234")
            user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.full_name = "سارا محمدی"
        profile.headline = "توسعه‌دهنده جونیور فرانت‌اند"
        profile.skills = ["HTML", "CSS", "JavaScript", "React", "Git"]
        profile.experience_years = 0.5
        profile.level = "junior"
        profile.target_role = "فرانت‌اند"
        profile.city = "تهران"
        profile.remote_only = False
        profile.completed = True
        profile.save()

        jobs_created = 0
        for job in JOBS:
            _, was_created = JobPosting.objects.get_or_create(
                source="seed",
                source_ref="seed:" + job["company"] + ":" + job["title"],
                defaults={
                    "title": job["title"],
                    "company": job["company"],
                    "city": job["city"],
                    "level": job["level"],
                    "required_skills": job["required_skills"],
                    "optional_skills": job.get("optional_skills") or [],
                    "job_types": job.get("job_types") or [],
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                    "description": job.get("description") or "",
                },
            )
            if was_created:
                jobs_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded demo user (demo/demo1234) and "
                + str(jobs_created)
                + " new job postings."
            )
        )
