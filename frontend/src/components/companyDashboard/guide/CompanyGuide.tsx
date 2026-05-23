import { useCallback, useEffect } from 'react';
import { COMPANY_GUIDE_CHECKLIST, GuideTourStep } from './companyGuideData';
import CompanyGuidePanel from './CompanyGuidePanel';
import CompanyGuideTour from './CompanyGuideTour';
import CompanyGuideWelcome from './CompanyGuideWelcome';
import { useCompanyGuide } from './useCompanyGuide';

interface CompanyGuideProps {
  userId: string | undefined;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsSubTabChange: (subTab: string) => void;
  ready: boolean;
}

export default function CompanyGuide({
  userId,
  activeTab,
  onTabChange,
  onSettingsSubTabChange,
  ready,
}: CompanyGuideProps) {
  const guide = useCompanyGuide(userId);

  useEffect(() => {
    if (!ready || !guide.hydrated || !guide.showFirstVisitWelcome) return;
    guide.setWelcomeOpen(true);
  }, [ready, guide.hydrated, guide.showFirstVisitWelcome]);

  const handleTourNavigate = useCallback(
    (step: GuideTourStep) => {
      if (step.tab !== activeTab) {
        onTabChange(step.tab);
      }
      if (step.settingsSubTab) {
        onSettingsSubTabChange(step.settingsSubTab);
      }
    },
    [activeTab, onTabChange, onSettingsSubTabChange]
  );

  const handleGoToTask = useCallback(
    (taskId: string) => {
      const item = COMPANY_GUIDE_CHECKLIST.find((t) => t.id === taskId);
      if (!item) return;
      onTabChange(item.tab);
      if (item.settingsSubTab) {
        onSettingsSubTabChange(item.settingsSubTab);
      }
      guide.closePanel();
    },
    [guide, onTabChange, onSettingsSubTabChange]
  );

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        onClick={guide.openPanel}
        data-guide="help-button"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[80] relative flex items-center gap-2 bg-orange-600 text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:bg-orange-700 transition-colors"
        title="Setup guide & tour"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-medium hidden sm:inline">Guide</span>
        {!guide.tourCompleted && guide.completedCount < guide.totalTasks && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-orange-600 text-xs font-bold rounded-full flex items-center justify-center border-2 border-orange-600">
            {guide.totalTasks - guide.completedCount}
          </span>
        )}
      </button>

      <CompanyGuideWelcome guide={guide} />
      <CompanyGuidePanel guide={guide} onGoToTask={handleGoToTask} />
      <CompanyGuideTour guide={guide} onNavigate={handleTourNavigate} />
    </>
  );
}
