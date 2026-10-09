'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { api, getToken, type MatchRow, type MatchDecisionResult, type GapPriorityResponse, type CareerMemorySnapshot } from '@/lib/api';
import RetroCard from '@/components/retro/RetroCard';
import { Sparkles, Search, ArrowRight, AlertCircle } from 'lucide-react';

interface Step1Props {
  onNext: (data: {
    selectedJob: MatchRow;
    matchResult: MatchDecisionResult;
    gapPriority: GapPriorityResponse;
    careerMemory: CareerMemorySnapshot;
  }) => void;
  onBack?: () => void;
}

export default function Step1JobSelection({ onNext, onBack }: Step1Props) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [matchResult, setMatchResult] = useState<MatchDecisionResult | null>(null);
  const [gapPriority, setGapPriority] = useState<GapPriorityResponse | null>(null);
  const [careerMemory, setCareerMemory] = useState<CareerMemorySnapshot | null>(null);

  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingGap, setLoadingGap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load job feed and career memory on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingFeed(true);
    setError(null);
    try {
      // Load job feed
      const feedData = await api<{ count: number; results: MatchRow[] }>('/jobs/feed/?limit=20');
      setRows(feedData.results);

      // Load career memory
      const memoryData = await api<CareerMemorySnapshot>('/career/memory/');
      setCareerMemory(memoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات');
    } finally {
      setLoadingFeed(false);
    }
  };

  const analyzeMatch = async (row: MatchRow) => {
    setSelected(row);
    setMatchResult(null);
    setGapPriority(null);
    setLoadingMatch(true);
    setError(null);

    try {
      // Analyze match
      const matchData = await api<{ match_result: MatchDecisionResult }>('/match/analyze/', {
        method: 'POST',
        body: JSON.stringify({ job_id: row.job.id }),
      });
      setMatchResult(matchData.match_result);

      // Load gap priority
      setLoadingGap(true);
      const gapData = await api<GapPriorityResponse>('/career/gap-priority/');
      setGapPriority(gapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در تحلیل تناسب');
    } finally {
      setLoadingMatch(false);
      setLoadingGap(false);
    }
  };

  const handleNext = () => {
    if (selected && matchResult && gapPriority && careerMemory) {
      onNext({
        selectedJob: selected,
        matchResult,
        gapPriority,
        careerMemory,
      });
    }
  };

  const decisionLabel = (value: string) => {
    const labels: Record<string, string> = {
      strong_match: 'تناسب قوی',
      good_match: 'تناسب خوب',
      partial_match: 'تناسب نسبی',
      weak_match: 'تناسب ضعیف',
      not_recommended: 'توصیه نمی‌شود',
      needs_more_information: 'نیازمند اطلاعات بیشتر',
    };
    return labels[value] || value;
  };

  const statusIcon = (status: string) => {
    if (status === 'match') return '✓';
    if (status === 'conflict') return '✕';
    return '!';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#3B7A4A';
    if (score >= 45) return '#C98A1F';
    return '#B23A2E';
  };

  if (loadingFeed) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: '#5A5450' }}>
        در حال بارگذاری آگهی‌ها…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 text-center py-6 text-xs">
        <div style={{ color: '#B23A2E' }}>{error}</div>
        <Button
          size="sm"
          className="h-7 text-xs"
          style={{ backgroundColor: '#F2C230', color: '#141311' }}
          onClick={loadData}
        >
          تلاش مجدد
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" style={{ color: '#F2C230' }} />
          <h2 className="font-bold text-sm">مرحله ۱: انتخاب آگهی</h2>
        </div>
        <p className="text-xs" style={{ color: '#5A5450' }}>
          یک آگهی را انتخاب کنید تا تناسب پروفایل شما و شکاف‌های مهارتی نمایش داده شود.
        </p>
      </div>

      <Separator style={{ backgroundColor: '#141311' }} />

      {/* Search */}
      <div className="flex gap-1">
        <Input
          placeholder="جستجو در آگهی‌ها…"
          className="h-7 text-xs"
          style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
        />
        <Button size="icon" className="size-7" style={{ backgroundColor: '#F2C230', color: '#141311' }}>
          <Search className="size-3" />
        </Button>
      </div>

      {/* Job List */}
      <div className="flex gap-2">
        {/* Left Panel - Job Feed */}
        <div className="flex-1 space-y-1 overflow-y-auto max-h-96 border-r-2 pr-2" style={{ borderRightColor: '#141311' }}>
          {rows.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
              هنوز آگهی موجود نیست
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.job.id}
                className={`p-2 cursor-pointer text-xs border-2 ${
                  selected?.job.id === row.job.id ? 'border-[#F2C230]' : 'border-[#141311]'
                }`}
                onClick={() => setSelected(row)}
                style={{
                  backgroundColor: selected?.job.id === row.job.id ? '#FCE9A8' : 'transparent',
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="font-bold">{row.job.title}</div>
                    <div style={{ color: '#5A5450' }}>
                      {row.job.company} • {row.job.city}
                    </div>
                  </div>
                  <div
                    className="size-8 flex items-center justify-center font-bold shrink-0 border-2"
                    style={{
                      backgroundColor: getScoreColor(row.score),
                      borderColor: '#141311',
                      color: '#FBF7EC',
                    }}
                  >
                    {row.score}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Panel - Job Details */}
        {selected && (
          <div className="w-80 flex flex-col gap-2 overflow-y-auto max-h-96 border-l-2 pl-2" style={{ borderLeftColor: '#141311' }}>
            {loadingMatch ? (
              <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
                در حال تحلیل تناسب…
              </div>
            ) : matchResult ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{selected.job.title}</h3>
                  <div className="text-center">
                    <div
                      className="size-12 flex items-center justify-center font-bold border-4 mx-auto"
                      style={{
                        backgroundColor: getScoreColor(matchResult.overall_score),
                        borderColor: '#141311',
                        color: '#FBF7EC',
                      }}
                    >
                      {matchResult.overall_score}٪
                    </div>
                    <div className="text-[10px] mt-1">{decisionLabel(matchResult.overall_decision)}</div>
                  </div>
                </div>

                <Separator style={{ backgroundColor: '#141311' }} />

                {/* Fit Dimensions */}
                <div className="space-y-1">
                  <div className="font-bold">ابعاد تناسب:</div>
                  {[
                    ['تکنیکی', matchResult.technical_fit],
                    ['سابقه', matchResult.experience_fit],
                    ['تحصیلات', matchResult.education_fit],
                  ].map(([label, dim]) => {
                    const d = dim as MatchDecisionResult['technical_fit'];
                    return (
                      <div
                        key={String(label)}
                        className="p-1 border-2"
                        style={{
                          backgroundColor: d.status === 'match' ? '#FCE9A8' : 'transparent',
                          borderColor: '#141311',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="size-4 flex items-center justify-center font-bold text-[9px]"
                            style={{
                              backgroundColor:
                                d.status === 'match'
                                  ? '#3B7A4A'
                                  : d.status === 'conflict'
                                  ? '#B23A2E'
                                  : '#C98A1F',
                              color: '#FBF7EC',
                            }}
                          >
                            {statusIcon(d.status)}
                          </span>
                          <span className="font-bold">{String(label)}</span>
                          <span className="mr-auto text-[10px]">
                            {d.score}/{d.max_score}
                          </span>
                        </div>
                        <div className="text-[10px] mt-1">{d.explanation}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Missing Skills */}
                {matchResult.missing_required_skills.length > 0 && (
                  <div>
                    <div className="font-bold text-[10px]">مهارت‌های الزامی بدون شواهد:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {matchResult.missing_required_skills.map((s) => (
                        <span
                          key={s}
                          className="text-[9px] px-1 border-2"
                          style={{ backgroundColor: '#B23A2E', color: '#FBF7EC', borderColor: '#141311' }}
                        >
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gap Priority */}
                {loadingGap ? (
                  <div className="text-[10px]" style={{ color: '#5A5450' }}>
                    در حال تحلیل شکاف‌های مهارتی…
                  </div>
                ) : gapPriority && gapPriority.prioritized_gaps.length > 0 ? (
                  <div className="space-y-1">
                    <div className="font-bold text-[10px]">شکاف‌های مهارتی با اولویت بالا:</div>
                    {gapPriority.prioritized_gaps.slice(0, 3).map((gap) => (
                      <div
                        key={gap.skill}
                        className="p-1 border-2"
                        style={{ backgroundColor: '#FCE9A8', borderColor: '#141311' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{gap.skill}</span>
                          <span className="text-[10px]">{gap.impact_score}٪ تأثیر</span>
                        </div>
                        <div className="text-[10px]" style={{ color: '#5A5450' }}>
                          باز کردن {gap.jobs_unlocked} فرصت شغلی
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px]" style={{ color: '#5A5450' }}>
                    شکاف مهارتی قابل توجهی یافت نشد.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
                برای تحلیل تناسب روی دکمه زیر کلیک کنید
              </div>
            )}

            {!matchResult && (
              <Button
                size="sm"
                className="text-xs h-6 w-full"
                onClick={() => analyzeMatch(selected)}
                style={{ backgroundColor: '#F2C230', color: '#141311' }}
              >
                <Sparkles className="size-3 mr-1" />
                تحلیل تناسب
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-2 border-t-2 pt-4 justify-end" style={{ borderTopColor: '#141311' }}>
        {onBack && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-6"
            style={{ borderColor: '#141311', color: '#141311' }}
            onClick={onBack}
          >
            بازگشت
          </Button>
        )}
        <Button
          size="sm"
          className="text-xs h-6"
          disabled={!selected || !matchResult || !gapPriority}
          onClick={handleNext}
          style={{
            backgroundColor: selected && matchResult && gapPriority ? '#F2C230' : '#C9C3BB',
            color: '#141311',
          }}
        >
          ادامه
          <ArrowRight className="size-3 mr-1" />
        </Button>
      </div>
    </div>
  );
}
