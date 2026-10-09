'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import RetroCard from '@/components/retro/RetroCard';
import { ArrowRight, ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import type {
  PendingChange,
  ChangeType,
  SkillChangeData,
  ExperienceChangeData,
  EducationChangeData,
  LanguageChangeData,
  ProjectChangeData,
} from '../types';
import type { CareerMemorySnapshot } from '@/lib/api';
import { generateChangeId, hasEvidence } from '../utils';

interface Step2Props {
  careerMemory: CareerMemorySnapshot;
  pendingChanges: PendingChange[];
  setPendingChanges: (changes: PendingChange[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2Alignment({
  careerMemory,
  pendingChanges,
  setPendingChanges,
  onNext,
  onBack,
}: Step2Props) {
  const [activeTab, setActiveTab] = useState<ChangeType>('skill');
  const [newSkill, setNewSkill] = useState('');
  const [newExperience, setNewExperience] = useState({ title: '', company: '', description: '' });
  const [newLanguage, setNewLanguage] = useState({ name: '', level: '' });

  // Helper to add a new change
  const addChange = (type: ChangeType, data: unknown, hasEv: boolean = false) => {
    const change: PendingChange = {
      id: generateChangeId(),
      type,
      action: 'add',
      data,
      confirmed: false,
      hasEvidence: hasEv,
    };
    setPendingChanges([...pendingChanges, change]);
  };

  // Helper to toggle confirmation
  const toggleConfirmation = (id: string) => {
    setPendingChanges(
      pendingChanges.map((c) => (c.id === id ? { ...c, confirmed: !c.confirmed } : c))
    );
  };

  // Helper to remove a change
  const removeChange = (id: string) => {
    setPendingChanges(pendingChanges.filter((c) => c.id !== id));
  };

  // Add confirmed skills from Career Memory
  const addCareerMemorySkills = () => {
    const confirmedSkills = careerMemory.skills.filter((s: { status: string }) => s.status === 'confirmed');
    confirmedSkills.forEach((skill: { name: string; level?: string; years_of_experience?: number }) => {
      const data: SkillChangeData = {
        name: skill.name,
        level: skill.level,
        years_of_experience: skill.years_of_experience,
        source: 'career_memory',
      };
      addChange('skill', data, true);
    });
  };

  // Add confirmed experiences from Career Memory
  const addCareerMemoryExperiences = () => {
    careerMemory.experiences.forEach((exp: { description?: string; title?: string; company?: string; start?: string; end?: string }) => {
      if (exp.description && exp.description.length > 0) {
        const data: ExperienceChangeData = {
          title: exp.title,
          company: exp.company,
          description: exp.description,
          start: exp.start,
          end: exp.end,
          source: 'career_memory',
        };
        addChange('experience', data, true);
      }
    });
  };

  // Add new skill
  const handleAddSkill = () => {
    if (newSkill.trim()) {
      const data: SkillChangeData = { name: newSkill.trim(), source: 'user_input' };
      addChange('skill', data, false);
      setNewSkill('');
    }
  };

  // Add new experience
  const handleAddExperience = () => {
    if (newExperience.title.trim() || newExperience.description.trim()) {
      const data: ExperienceChangeData = {
        title: newExperience.title.trim(),
        company: newExperience.company.trim(),
        description: newExperience.description.trim(),
        source: 'user_input',
      };
      addChange('experience', data, !!newExperience.description.trim());
      setNewExperience({ title: '', company: '', description: '' });
    }
  };

  // Add new language
  const handleAddLanguage = () => {
    if (newLanguage.name.trim() && newLanguage.level.trim()) {
      const data: LanguageChangeData = {
        name: newLanguage.name.trim(),
        level: newLanguage.level.trim(),
        source: 'user_input',
      };
      addChange('language', data, false);
      setNewLanguage({ name: '', level: '' });
    }
  };

  // Get changes for current tab
  const getTabChanges = () => pendingChanges.filter((c) => c.type === activeTab);

  // Check if Career Memory items are already added
  const hasCareerMemorySkills = pendingChanges.some(
    (c) => c.type === 'skill' && (c.data as SkillChangeData).source === 'career_memory'
  );
  const hasCareerMemoryExperiences = pendingChanges.some(
    (c) => c.type === 'experience' && (c.data as ExperienceChangeData).source === 'career_memory'
  );

  const confirmedCount = pendingChanges.filter((c) => c.confirmed).length;
  const canProceed = confirmedCount > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-bold text-sm">مرحله ۲: هم‌راستاسازی اطلاعات</h2>
        <p className="text-xs" style={{ color: '#5A5450' }}>
          اطلاعات رزومه را مرور کنید و تغییرات را به‌صورت صریح تأیید کنید. تغییرات تأییدنشده در رزومه نهایی لحاظ نمی‌شوند.
        </p>
      </div>

      <Separator style={{ backgroundColor: '#141311' }} />

      {/* Tabs */}
      <div className="flex gap-1 border-b-2 pb-2" style={{ borderBottomColor: '#141311' }}>
        {(['skill', 'experience', 'education', 'language', 'project'] as ChangeType[]).map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1 text-xs border-2 ${
              activeTab === tab ? 'border-[#F2C230] bg-[#FCE9A8]' : 'border-[#141311]'
            }`}
            onClick={() => setActiveTab(tab)}
            style={{ backgroundColor: activeTab === tab ? '#FCE9A8' : 'transparent' }}
          >
            {tab === 'skill' && 'مهارت‌ها'}
            {tab === 'experience' && 'تجربه‌ها'}
            {tab === 'education' && 'تحصیلات'}
            {tab === 'language' && 'زبان‌ها'}
            {tab === 'project' && 'پروژه‌ها'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {/* Skills Tab */}
        {activeTab === 'skill' && (
          <div className="space-y-3">
            {!hasCareerMemorySkills && careerMemory.skills.length > 0 && (
              <Button
                size="sm"
                className="text-xs h-6 w-full"
                onClick={addCareerMemorySkills}
                style={{ backgroundColor: '#F2C230', color: '#141311' }}
              >
                افزودن مهارت‌های تأییدشده از Career Memory
              </Button>
            )}

            <div className="flex gap-1">
              <Input
                placeholder="مهارت جدید…"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="h-7 text-xs flex-1"
                style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
              />
              <Button size="icon" className="size-7" onClick={handleAddSkill} style={{ backgroundColor: '#F2C230', color: '#141311' }}>
                <Plus className="size-3" />
              </Button>
            </div>

            <div className="space-y-1">
              {getTabChanges().map((change) => {
                const data = change.data as SkillChangeData;
                return (
                  <div
                    key={change.id}
                    className="p-2 border-2 flex items-start gap-2"
                    style={{
                      backgroundColor: change.confirmed ? '#FCE9A8' : 'transparent',
                      borderColor: '#141311',
                    }}
                  >
                    <div
                      className={`flex items-center justify-center w-4 h-4 border-2 flex-shrink-0 mt-0.5 cursor-pointer ${
                        change.confirmed ? 'bg-[#3B7A4A]' : 'bg-[#FBF7EC]'
                      }`}
                      style={{ borderColor: '#141311' }}
                      onClick={() => toggleConfirmation(change.id)}
                    >
                      {change.confirmed && <span className="font-bold text-sm text-[#FBF7EC]">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-xs">{data.name}</div>
                      {data.level && <div className="text-[10px]" style={{ color: '#5A5450' }}>{data.level}</div>}
                      {data.source === 'career_memory' && (
                        <Badge className="text-[9px]" style={{ backgroundColor: '#3B7A4A', color: '#FBF7EC' }}>
                          از Career Memory
                        </Badge>
                      )}
                    </div>
                    <Button size="icon" className="size-5" onClick={() => removeChange(change.id)} style={{ backgroundColor: '#B23A2E', color: '#FBF7EC' }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                );
              })}
              {getTabChanges().length === 0 && (
                <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
                  هنوز مهارتی اضافه نشده
                </div>
              )}
            </div>
          </div>
        )}

        {/* Experiences Tab */}
        {activeTab === 'experience' && (
          <div className="space-y-3">
            {!hasCareerMemoryExperiences && careerMemory.experiences.length > 0 && (
              <Button
                size="sm"
                className="text-xs h-6 w-full"
                onClick={addCareerMemoryExperiences}
                style={{ backgroundColor: '#F2C230', color: '#141311' }}
              >
                افزودن تجربه‌های با شواهد از Career Memory
              </Button>
            )}

            <RetroCard title="تجربه جدید" variant="solid">
              <div className="space-y-2">
                <Input
                  placeholder="عنوان شغل"
                  value={newExperience.title}
                  onChange={(e) => setNewExperience({ ...newExperience, title: e.target.value })}
                  className="h-7 text-xs"
                  style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
                />
                <Input
                  placeholder="شرکت"
                  value={newExperience.company}
                  onChange={(e) => setNewExperience({ ...newExperience, company: e.target.value })}
                  className="h-7 text-xs"
                  style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
                />
                <textarea
                  placeholder="توضیحات (به‌عنوان شواهد)…"
                  value={newExperience.description}
                  onChange={(e) => setNewExperience({ ...newExperience, description: e.target.value })}
                  className="w-full h-16 text-xs p-2 border-2"
                  style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311', resize: 'vertical' }}
                />
                <Button size="sm" className="text-xs h-6 w-full" onClick={handleAddExperience} style={{ backgroundColor: '#F2C230', color: '#141311' }}>
                  <Plus className="size-3 mr-1" />
                  افزودن تجربه
                </Button>
              </div>
            </RetroCard>

            <div className="space-y-1">
              {getTabChanges().map((change) => {
                const data = change.data as ExperienceChangeData;
                return (
                  <div
                    key={change.id}
                    className="p-2 border-2 flex items-start gap-2"
                    style={{
                      backgroundColor: change.confirmed ? '#FCE9A8' : 'transparent',
                      borderColor: '#141311',
                    }}
                  >
                    <div
                      className={`flex items-center justify-center w-4 h-4 border-2 flex-shrink-0 mt-0.5 cursor-pointer ${
                        change.confirmed ? 'bg-[#3B7A4A]' : 'bg-[#FBF7EC]'
                      }`}
                      style={{ borderColor: '#141311' }}
                      onClick={() => toggleConfirmation(change.id)}
                    >
                      {change.confirmed && <span className="font-bold text-sm text-[#FBF7EC]">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-xs">{data.title || 'بدون عنوان'}</div>
                      <div className="text-[10px]" style={{ color: '#5A5450' }}>
                        {data.company || 'بدون شرکت'}
                      </div>
                      {data.description && (
                        <div className="text-[10px] mt-1" style={{ color: '#5A5450' }}>
                          {data.description.substring(0, 100)}…
                        </div>
                      )}
                      {data.source === 'career_memory' && (
                        <Badge className="text-[9px]" style={{ backgroundColor: '#3B7A4A', color: '#FBF7EC' }}>
                          از Career Memory
                        </Badge>
                      )}
                      {!hasEvidence(change) && (
                        <div className="flex items-center gap-1 mt-1 text-[9px]" style={{ color: '#C98A1F' }}>
                          <AlertCircle className="size-3" />
                          بدون شواهد
                        </div>
                      )}
                    </div>
                    <Button size="icon" className="size-5" onClick={() => removeChange(change.id)} style={{ backgroundColor: '#B23A2E', color: '#FBF7EC' }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                );
              })}
              {getTabChanges().length === 0 && (
                <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
                  هنوز تجربه‌ای اضافه نشده
                </div>
              )}
            </div>
          </div>
        )}

        {/* Languages Tab */}
        {activeTab === 'language' && (
          <div className="space-y-3">
            <div className="flex gap-1">
              <Input
                placeholder="زبان"
                value={newLanguage.name}
                onChange={(e) => setNewLanguage({ ...newLanguage, name: e.target.value })}
                className="h-7 text-xs flex-1"
                style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
              />
              <Input
                placeholder="سطح"
                value={newLanguage.level}
                onChange={(e) => setNewLanguage({ ...newLanguage, level: e.target.value })}
                className="h-7 text-xs w-24"
                style={{ backgroundColor: '#FBF7EC', borderColor: '#141311', color: '#141311' }}
              />
              <Button size="icon" className="size-7" onClick={handleAddLanguage} style={{ backgroundColor: '#F2C230', color: '#141311' }}>
                <Plus className="size-3" />
              </Button>
            </div>

            <div className="space-y-1">
              {getTabChanges().map((change) => {
                const data = change.data as LanguageChangeData;
                return (
                  <div
                    key={change.id}
                    className="p-2 border-2 flex items-start gap-2"
                    style={{
                      backgroundColor: change.confirmed ? '#FCE9A8' : 'transparent',
                      borderColor: '#141311',
                    }}
                  >
                    <div
                      className={`flex items-center justify-center w-4 h-4 border-2 flex-shrink-0 mt-0.5 cursor-pointer ${
                        change.confirmed ? 'bg-[#3B7A4A]' : 'bg-[#FBF7EC]'
                      }`}
                      style={{ borderColor: '#141311' }}
                      onClick={() => toggleConfirmation(change.id)}
                    >
                      {change.confirmed && <span className="font-bold text-sm text-[#FBF7EC]">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-xs">{data.name}</div>
                      <div className="text-[10px]" style={{ color: '#5A5450' }}>{data.level}</div>
                    </div>
                    <Button size="icon" className="size-5" onClick={() => removeChange(change.id)} style={{ backgroundColor: '#B23A2E', color: '#FBF7EC' }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                );
              })}
              {getTabChanges().length === 0 && (
                <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
                  هنوز زبانی اضافه نشده
                </div>
              )}
            </div>
          </div>
        )}

        {/* Education Tab */}
        {activeTab === 'education' && (
          <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
            بخش تحصیلات در این نسخه پیاده‌سازی نشده است.
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'project' && (
          <div className="text-xs text-center py-4" style={{ color: '#5A5450' }}>
            بخش پروژه‌ها در این نسخه پیاده‌سازی نشده است.
          </div>
        )}
      </div>

      {/* Summary */}
      <RetroCard title="خلاصه تغییرات" variant="solid">
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>تعداد تغییرات:</span>
            <span className="font-bold">{pendingChanges.length}</span>
          </div>
          <div className="flex justify-between">
            <span>تأییدشده:</span>
            <span className="font-bold" style={{ color: '#3B7A4A' }}>{confirmedCount}</span>
          </div>
          <div className="flex justify-between">
            <span>تأییدنشده:</span>
            <span className="font-bold" style={{ color: '#C98A1F' }}>{pendingChanges.length - confirmedCount}</span>
          </div>
        </div>
      </RetroCard>

      {/* Navigation */}
      <div className="flex gap-2 border-t-2 pt-4 justify-between" style={{ borderTopColor: '#141311' }}>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-6"
          style={{ borderColor: '#141311', color: '#141311' }}
          onClick={onBack}
        >
          <ArrowLeft className="size-3 mr-1" />
          بازگشت
        </Button>
        <Button
          size="sm"
          className="text-xs h-6"
          disabled={!canProceed}
          onClick={onNext}
          style={{
            backgroundColor: canProceed ? '#F2C230' : '#C9C3BB',
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
