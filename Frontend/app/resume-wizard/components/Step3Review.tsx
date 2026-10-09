'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import RetroCard from '@/components/retro/RetroCard';
import { ArrowLeft, Download, RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { PendingChange } from '../types';
import type { CareerMemorySnapshot, ResumeContent, TruthReportResponse } from '@/lib/api';
import { buildProposedResume, validatePdfResponse } from '../utils';
import { createResume, getTruthReport, resumePdfUrl } from '@/lib/api';

interface Step3Props {
  careerMemory: CareerMemorySnapshot;
  pendingChanges: PendingChange[];
  onBack: () => void;
  onComplete: () => void;
}

export default function Step3Review({
  careerMemory,
  pendingChanges,
  onBack,
  onComplete,
}: Step3Props) {
  const [proposedResume, setProposedResume] = useState<ResumeContent | null>(() =>
    buildProposedResume(careerMemory, pendingChanges)
  );
  const [savedResumeId, setSavedResumeId] = useState<number | null>(null);
  const [truthReport, setTruthReport] = useState<TruthReportResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!proposedResume) return;

    setIsSaving(true);
    setError(null);

    try {
      // Save resume
      const result = await createResume({
        title: 'رزومهٔ ساخته‌شده با ویزارد',
        content: proposedResume,
      });
      setSavedResumeId(result.id);

      // Load truth report
      setIsLoadingReport(true);
      const report = await getTruthReport(result.id);
      setTruthReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره رزومه');
    } finally {
      setIsSaving(false);
      setIsLoadingReport(false);
    }
  };

  const handleRetryReport = async () => {
    if (!savedResumeId) return;

    setIsLoadingReport(true);
    setError(null);

    try {
      const report = await getTruthReport(savedResumeId);
      setTruthReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت گزارش حقیقت');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!savedResumeId) return;

    setIsDownloadingPdf(true);
    setPdfError(null);

    try {
      const url = resumePdfUrl(savedResumeId);
      const response = await fetch(url);

      const contentType = response.headers.get('Content-Type');
      const pdfMode = response.headers.get('X-Resume-PDF-Mode');

      const validation = validatePdfResponse(contentType, pdfMode);

      if (!validation.valid) {
        setPdfError(validation.error || 'خطا در دانلود PDF');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `resume-v${savedResumeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'خطا در دانلود PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const scoreToPercent = (score: number): number => {
    if (typeof score !== 'number' || isNaN(score)) return 0;
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return { bg: '#3B7A4A', text: '#FBF7EC', label: '✓ تأییدشده' };
      case 'needs_clarification':
        return { bg: '#C98A1F', text: '#FBF7EC', label: '⚠ نیاز به توضیح' };
      case 'unsupported':
        return { bg: '#B23A2E', text: '#FBF7EC', label: '✕ بدون مدرک' };
      default:
        return { bg: '#8B8680', text: '#FBF7EC', label: 'نامشخص' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-bold text-sm">مرحله ۳: پیش‌نمایش و ذخیره</h2>
        <p className="text-xs" style={{ color: '#5A5450' }}>
          پیش‌نمایش رزومه را بررسی کنید، در صورت نیاز ویرایش کنید، و سپس ذخیره کنید.
        </p>
      </div>

      <Separator style={{ backgroundColor: '#141311' }} />

      {/* Proposed Resume Preview */}
      <RetroCard variant="solid" title="پیش‌نمایش رزومه">
        {proposedResume ? (
          <div className="space-y-3 text-xs">
            {/* Skills */}
            {proposedResume.skills && proposedResume.skills.length > 0 && (
              <div>
                <div className="font-bold mb-1">مهارت‌ها:</div>
                <div className="flex flex-wrap gap-1">
                  {proposedResume.skills.map((skill: { name: string }, idx: number) => (
                    <Badge key={idx} variant="success" className="text-[9px] bg-[#3B7A4A] text-[#FBF7EC] border-0">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Experiences */}
            {proposedResume.experiences && proposedResume.experiences.length > 0 && (
              <div>
                <div className="font-bold mb-1">تجربه‌های شغلی:</div>
                <div className="space-y-1">
                  {proposedResume.experiences.map((exp: { title?: string; company?: string; description?: string }, idx: number) => (
                    <div key={idx} className="p-1 border-2" style={{ backgroundColor: '#FCE9A8', borderColor: '#141311' }}>
                      <div className="font-bold">{exp.title || 'بدون عنوان'}</div>
                      <div style={{ color: '#5A5450' }}>{exp.company || 'بدون شرکت'}</div>
                      {exp.description && (
                        <div className="text-[10px] mt-1" style={{ color: '#5A5450' }}>
                          {exp.description.substring(0, 150)}…
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {proposedResume.languages && proposedResume.languages.length > 0 && (
              <div>
                <div className="font-bold mb-1">زبان‌ها:</div>
                <div className="flex flex-wrap gap-1">
                  {proposedResume.languages.map((lang: { name: string; level: string }, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[9px]">
                      {lang.name} ({lang.level})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {proposedResume.projects && proposedResume.projects.length > 0 && (
              <div>
                <div className="font-bold mb-1">پروژه‌ها:</div>
                <div className="space-y-1">
                  {proposedResume.projects.map((proj: { name?: string; description?: string }, idx: number) => (
                    <div key={idx} className="p-1 border-2" style={{ backgroundColor: '#FCE9A8', borderColor: '#141311' }}>
                      <div className="font-bold">{proj.name || 'بدون نام'}</div>
                      {proj.description && (
                        <div className="text-[10px]" style={{ color: '#5A5450' }}>
                          {proj.description.substring(0, 100)}…
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
            رزومهٔ پیشنهادی خالی است
          </div>
        )}
      </RetroCard>

      {/* Save Section */}
      {!savedResumeId ? (
        <div className="space-y-2">
          {error && (
            <RetroCard title="خطا" variant="error">
              <div className="text-xs">{error}</div>
            </RetroCard>
          )}

          <Button
            size="lg"
            className="w-full text-sm h-8"
            disabled={isSaving || !proposedResume}
            onClick={handleSave}
            style={{
              backgroundColor: !isSaving && proposedResume ? '#F2C230' : '#C9C3BB',
              color: '#141311',
            }}
          >
            {isSaving ? 'در حال ذخیره…' : 'ذخیره رزومه'}
          </Button>

          <p className="text-[10px] text-center" style={{ color: '#5A5450' }}>
            پس از ذخیره، گزارش حقیقت به‌صورت خودکار دریافت می‌شود.
          </p>
        </div>
      ) : (
        /* Truth Report Section */
        <div className="space-y-3">
          <RetroCard title="✓ رزومه با موفقیت ذخیره شد" variant="success">
            <div className="text-xs">شناسه رزومه: {savedResumeId}</div>
          </RetroCard>

          {isLoadingReport ? (
            <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
              در حال دریافت گزارش حقیقت…
            </div>
          ) : truthReport ? (
            <RetroCard title="گزارش حقیقت" variant="solid">
              <div className="space-y-3 text-xs">
                {/* Overall Score */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">امتیاز کلی حقیقت</div>
                    <div className="text-[10px]" style={{ color: '#5A5450' }}>
                      درصد ادعاهای تأییدشده
                    </div>
                  </div>
                  <div
                    className="size-16 flex items-center justify-center text-2xl font-bold border-4"
                    style={{
                      backgroundColor:
                        scoreToPercent(truthReport.overall_truth_score) >= 70
                          ? '#3B7A4A'
                          : scoreToPercent(truthReport.overall_truth_score) >= 45
                          ? '#C98A1F'
                          : '#B23A2E',
                      borderColor: '#141311',
                      color: '#FBF7EC',
                    }}
                  >
                    {scoreToPercent(truthReport.overall_truth_score)}٪
                  </div>
                </div>

                <Separator style={{ backgroundColor: '#141311' }} />

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 border-2 text-center" style={{ borderColor: '#141311' }}>
                    <div className="text-[10px] font-bold" style={{ color: '#3B7A4A' }}>
                      ✓ تأییدشده
                    </div>
                    <div className="text-sm font-bold mt-1">{truthReport.verified_claims}</div>
                  </div>
                  <div className="p-2 border-2 text-center" style={{ borderColor: '#141311' }}>
                    <div className="text-[10px] font-bold" style={{ color: '#C98A1F' }}>
                      ! نیاز به توضیح
                    </div>
                    <div className="text-sm font-bold mt-1">{truthReport.needs_clarification_claims}</div>
                  </div>
                  <div className="p-2 border-2 text-center" style={{ borderColor: '#141311' }}>
                    <div className="text-[10px] font-bold" style={{ color: '#B23A2E' }}>
                      ✕ بدون مدرک
                    </div>
                    <div className="text-sm font-bold mt-1">{truthReport.unsupported_claims}</div>
                  </div>
                </div>

                {/* Claims Detail */}
                {truthReport.truth_report.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-bold text-[10px]">جزئیات ادعاها:</div>
                    {truthReport.truth_report.slice(0, 5).map((claim: { status: string; claim_text: string; context?: string }, idx: number) => {
                      const badge = getStatusBadge(claim.status);
                      return (
                        <div
                          key={idx}
                          className="p-1 border-2 flex items-start gap-1"
                          style={{
                            backgroundColor: claim.status === 'verified' ? '#FCE9A8' : 'transparent',
                            borderColor: '#141311',
                          }}
                        >
                          <div
                            className="size-5 flex items-center justify-center font-bold text-[9px] shrink-0"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            {badge.label[0]}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold">{claim.claim_text}</div>
                            <div className="text-[10px]" style={{ color: '#5A5450' }}>
                              {claim.context || 'خلاصه / متن رزومه'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {truthReport.truth_report.length > 5 && (
                      <div className="text-[10px] text-center" style={{ color: '#5A5450' }}>
                        و {truthReport.truth_report.length - 5} ادعای دیگر…
                      </div>
                    )}
                  </div>
                )}
              </div>
            </RetroCard>
          ) : (
            <div className="space-y-2">
              <RetroCard title="گزارش حقیقت دریافت نشد" variant="warning">
                <div className="text-xs">
                  دریافت گزارش حقیقت با مشکل مواجه شد. می‌توانید تلاش مجدد کنید.
                </div>
              </RetroCard>
              <Button
                size="sm"
                className="text-xs h-6 w-full"
                onClick={handleRetryReport}
                style={{ backgroundColor: '#F2C230', color: '#141311' }}
              >
                <RefreshCw className="size-3 mr-1" />
                تلاش مجدد برای دریافت گزارش
              </Button>
            </div>
          )}

          {/* PDF Download */}
          {truthReport && (
            <div className="space-y-2">
              {pdfError && (
                <RetroCard title="خطا در دانلود PDF" variant="error">
                  <div className="text-xs">{pdfError}</div>
                </RetroCard>
              )}

              <Button
                size="sm"
                className="text-xs h-6 w-full"
                disabled={isDownloadingPdf}
                onClick={handleDownloadPdf}
                style={{
                  backgroundColor: !isDownloadingPdf ? '#F2C230' : '#C9C3BB',
                  color: '#141311',
                }}
              >
                {isDownloadingPdf ? 'در حال دانلود…' : (
                  <>
                    <Download className="size-3 mr-1" />
                    دانلود PDF
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Complete Button */}
          <Button
            size="lg"
            className="w-full text-sm h-8"
            onClick={onComplete}
            style={{ backgroundColor: '#3B7A4A', color: '#FBF7EC' }}
          >
            <CheckCircle className="size-4 mr-1" />
            اتمام و بازگشت به صفحه رزومه
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 border-t-2 pt-4" style={{ borderTopColor: '#141311' }}>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-6"
          style={{ borderColor: '#141311', color: '#141311' }}
          onClick={onBack}
          disabled={isSaving || isLoadingReport}
        >
          <ArrowLeft className="size-3 mr-1" />
          بازگشت
        </Button>
      </div>
    </div>
  );
}
