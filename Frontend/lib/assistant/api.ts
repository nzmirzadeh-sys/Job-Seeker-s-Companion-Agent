import {
  api,
  analyzeJobForInterview,
  getGapPriority,
  getToken,
  listResumes,
  type MatchRow,
} from '@/lib/api';
import type { AssistantJobCard, AssistantProfile, AssistantQuickActionResult } from './types';

const TODO_MOCK = 'TODO: mock until backend contract is finalized';

function mockJobsFromProfile(profile: Partial<AssistantProfile>): AssistantJobCard[] {
  const role = profile.role ?? 'فرانت‌اند';
  const city = profile.location ?? 'تهران';
  const skills = profile.skills?.length ? profile.skills : ['React', 'TypeScript'];

  return [
    {
      id: 'mock-1',
      title: `${role} Engineer`,
      company: 'Karvia Labs',
      city,
      type: profile.remote ?? 'Remote',
      match: 94,
      matchLabel: 'تناسب قوی',
      summary: 'برای یک تیم محصول با تمرکز بر تجربه کاربری و سرعت اجرا مناسب است.',
      skills: skills.slice(0, 3),
    },
    {
      id: 'mock-2',
      title: 'Senior UI Developer',
      company: 'Nova Studio',
      city,
      type: 'Hybrid',
      match: 88,
      matchLabel: 'تناسب خوب',
      summary: 'پروژه‌های محصولی و همکاری نزدیک با طراح و مدیر محصول.',
      skills: ['UI', 'Figma', 'React'],
    },
    {
      id: 'mock-3',
      title: 'Frontend Product Engineer',
      company: 'Asteric',
      city: 'شیراز',
      type: 'Onsite',
      match: 82,
      matchLabel: 'تناسب خوب',
      summary: 'تمرکز بر تجربه کاربر و ساخت ابزارهای داخلی با کیفیت بالاتر.',
      skills: ['Next.js', 'TypeScript', 'Design'],
    },
  ];
}

async function fetchJobsFromApi(profile: Partial<AssistantProfile>): Promise<AssistantJobCard[]> {
  const token = getToken();
  if (!token) {
    return mockJobsFromProfile(profile);
  }

  try {
    const data = await api<{ count: number; results: MatchRow[] }>('/jobs/feed/?limit=6');
    return (data.results ?? []).slice(0, 6).map((item) => ({
      id: item.job.id,
      title: item.job.title,
      company: item.job.company,
      city: item.job.city || 'دورکاری',
      type: item.job.job_types?.[0] || 'Remote',
      match: Math.round(item.score),
      matchLabel: item.score >= 85 ? 'تناسب قوی' : item.score >= 70 ? 'تناسب خوب' : 'تناسب متوسط',
      summary: item.reasons?.[0] || 'سازگاری خوبی با معیارهای شغلی شما دارد.',
      skills: item.job.required_skills?.slice(0, 3) ?? ['React', 'TypeScript'],
      url: undefined,
    }));
  } catch {
    return mockJobsFromProfile(profile);
  }
}

export async function getAssistantJobs(profile: Partial<AssistantProfile>): Promise<AssistantJobCard[]> {
  return fetchJobsFromApi(profile);
}

export async function saveAssistantJob(jobId: number | string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    await api(`/jobs/${jobId}/feedback/`, {
      method: 'POST',
      body: JSON.stringify({ relevant: true, reason: 'Saved from Karvia assistant' }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getResumeInsight(): Promise<AssistantQuickActionResult> {
  try {
    const resumes = await listResumes();
    if (!resumes.length) {
      return {
        title: 'تحلیل رزومه',
        summary: 'رزومه‌ای ثبت نشده؛ برای شروع، یک رزومه آپلود یا ایجاد کنید. ' + TODO_MOCK,
        status: 'soon',
      };
    }

    return {
      title: 'تحلیل رزومه',
      summary: `رزومهٔ فعال: ${resumes[0]?.title ?? 'بدون عنوان'} — نقاط قوت و پیشنهادهای بهبود آماده‌اند.`,
      status: 'ok',
    };
  } catch {
    return {
      title: 'تحلیل رزومه',
      summary: 'در حال حاضر این مسیر به‌صورت mock آماده است؛ در نسخهٔ Real، نتیجهٔ تحلیل رزومه از API /resumes و /truth-report می‌آید. ' + TODO_MOCK,
      status: 'soon',
    };
  }
}

export async function getInterviewPrep(): Promise<AssistantQuickActionResult> {
  try {
    const result = await analyzeJobForInterview('Frontend engineer with React and TypeScript');
    const title = result?.job_analysis?.job?.title?.value ?? 'موقعیت شغلی';
    return {
      title: 'آمادگی مصاحبه',
      summary: `حالا می‌توانم برای «${title}» سؤال‌ها و معیارهای ارزیابی را آماده کنم.`,
      status: 'ok',
    };
  } catch {
    return {
      title: 'آمادگی مصاحبه',
      summary: 'این قابلیت در ادامه به endpoint واقعی مصاحبه وصل می‌شود. ' + TODO_MOCK,
      status: 'soon',
    };
  }
}

export async function getGrowthPath(): Promise<AssistantQuickActionResult> {
  try {
    const result = await getGapPriority();
    const topSkill = result.prioritized_gaps?.[0]?.skill ?? 'React';
    return {
      title: 'مسیر رشد',
      summary: `اولویت بعدی: ${topSkill}. با تمرکز روی این مهارت، شانس ورود به فرصت‌های بهتر افزایش می‌یابد.`,
      status: 'ok',
    };
  } catch {
    return {
      title: 'مسیر رشد',
      summary: 'مسیر رشد فعلاً با داده‌های mock و TODO آماده است تا در آینده از /career/gap-priority استفاده شود. ' + TODO_MOCK,
      status: 'soon',
    };
  }
}

export const assistantApi = {
  getAssistantJobs,
  saveAssistantJob,
  getResumeInsight,
  getInterviewPrep,
  getGrowthPath,
};
