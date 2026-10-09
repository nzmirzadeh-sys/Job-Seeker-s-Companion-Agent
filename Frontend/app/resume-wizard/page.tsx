'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/retro/RetroWindow';
import RetroButton from '@/components/retro/RetroButton';
import type { WizardStep, WizardState, PendingChange } from './types';
import type { MatchRow, MatchDecisionResult, GapPriorityResponse, CareerMemorySnapshot } from '@/lib/api';
import Step1JobSelection from './components/Step1JobSelection';
import Step2Alignment from './components/Step2Alignment';
import Step3Review from './components/Step3Review';

export default function ResumeWizardPage() {
  const router = useRouter();

  // Wizard State
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    selectedJob: null,
    matchResult: null,
    gapPriority: null,
    careerMemory: null,
    pendingChanges: [],
    proposedResume: null,
    savedResumeId: null,
    truthReport: null,
    isSaving: false,
    saveError: null,
  });

  const goToStep = (step: WizardStep) => {
    setState({ ...state, currentStep: step });
  };

  const handleStep1Complete = (data: {
    selectedJob: MatchRow;
    matchResult: MatchDecisionResult;
    gapPriority: GapPriorityResponse;
    careerMemory: CareerMemorySnapshot;
  }) => {
    setState({
      ...state,
      ...data,
      currentStep: 2,
    });
  };

  const handleStep2Complete = () => {
    goToStep(3);
  };

  const handleComplete = () => {
    router.push('/resume');
  };

  return (
    <main className="flex-1 min-h-screen p-4" style={{ backgroundColor: '#FBF7EC' }}>
      <div className="mx-auto max-w-6xl">
        <RetroWindow
          title="HAMRAH.EXE - ویزارد ساخت رزومه"
          menu={[
            { title: 'File' },
            { title: 'Edit' },
            { title: 'Format' },
            { title: 'View' },
            { title: 'Help' },
          ]}
          className="min-h-screen"
        >
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b-2" style={{ borderBottomColor: '#141311' }}>
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center gap-1 px-3 py-1 text-xs border-2 ${
                  state.currentStep === step ? 'border-[#F2C230] bg-[#FCE9A8]' : 'border-[#141311]'
                }`}
                style={{
                  backgroundColor: state.currentStep === step ? '#FCE9A8' : 'transparent',
                  color: '#141311',
                }}
              >
                <div
                  className="size-5 flex items-center justify-center font-bold text-[10px] border-2"
                  style={{
                    backgroundColor:
                      state.currentStep >= step ? '#3B7A4A' : '#C9C3BB',
                    borderColor: '#141311',
                    color: '#FBF7EC',
                  }}
                >
                  {state.currentStep > step ? '✓' : step}
                </div>
                <span className="font-bold">
                  {step === 1 && 'انتخاب آگهی'}
                  {step === 2 && 'هم‌راستاسازی'}
                  {step === 3 && 'پیش‌نمایش'}
                </span>
              </div>
            ))}
          </div>

          {/* Step Content */}
          {state.currentStep === 1 && (
            <Step1JobSelection
              onNext={handleStep1Complete}
              onBack={() => router.push('/')}
            />
          )}

          {state.currentStep === 2 && (
            <Step2Alignment
              careerMemory={state.careerMemory!}
              pendingChanges={state.pendingChanges}
              setPendingChanges={(changes) => setState({ ...state, pendingChanges: changes })}
              onNext={handleStep2Complete}
              onBack={() => goToStep(1)}
            />
          )}

          {state.currentStep === 3 && (
            <Step3Review
              careerMemory={state.careerMemory!}
              pendingChanges={state.pendingChanges}
              onBack={() => goToStep(2)}
              onComplete={handleComplete}
            />
          )}
        </RetroWindow>
      </div>
    </main>
  );
}
