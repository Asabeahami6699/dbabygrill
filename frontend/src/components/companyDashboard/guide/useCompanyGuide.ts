import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMPANY_GUIDE_CHECKLIST,
  COMPANY_GUIDE_TOUR_STEPS,
  CompanyTab,
  GuideChecklistItem,
  SettingsSubTab,
} from './companyGuideData';

interface GuidePersistedState {
  completedTaskIds: string[];
  tourCompleted: boolean;
  welcomeSeen: boolean;
}

const defaultState = (): GuidePersistedState => ({
  completedTaskIds: [],
  tourCompleted: false,
  welcomeSeen: false,
});

const storageKey = (userId: string) => `dbaby_company_guide_${userId}`;

function loadState(userId: string): GuidePersistedState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<GuidePersistedState>;
    return {
      completedTaskIds: Array.isArray(parsed.completedTaskIds) ? parsed.completedTaskIds : [],
      tourCompleted: Boolean(parsed.tourCompleted),
      welcomeSeen: Boolean(parsed.welcomeSeen),
    };
  } catch {
    return defaultState();
  }
}

function saveState(userId: string, state: GuidePersistedState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function useCompanyGuide(userId: string | undefined) {
  const [persisted, setPersisted] = useState<GuidePersistedState>(defaultState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHydrated(true);
      return;
    }
    setPersisted(loadState(userId));
    setHydrated(true);
  }, [userId]);

  const persist = useCallback(
    (next: GuidePersistedState) => {
      setPersisted(next);
      if (userId) saveState(userId, next);
    },
    [userId]
  );

  const completedCount = persisted.completedTaskIds.length;
  const totalTasks = COMPANY_GUIDE_CHECKLIST.length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);

  const checklist = useMemo(
    () =>
      COMPANY_GUIDE_CHECKLIST.map((item) => ({
        ...item,
        done: persisted.completedTaskIds.includes(item.id),
      })),
    [persisted.completedTaskIds]
  );

  const markTaskDone = useCallback(
    (taskId: string) => {
      if (persisted.completedTaskIds.includes(taskId)) return;
      persist({
        ...persisted,
        completedTaskIds: [...persisted.completedTaskIds, taskId],
      });
    },
    [persist, persisted]
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      if (persisted.completedTaskIds.includes(taskId)) {
        persist({
          ...persisted,
          completedTaskIds: persisted.completedTaskIds.filter((id) => id !== taskId),
        });
      } else {
        markTaskDone(taskId);
      }
    },
    [markTaskDone, persist, persisted]
  );

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false);
    persist({ ...persisted, welcomeSeen: true });
  }, [persist, persisted]);

  const startTour = useCallback(() => {
    setWelcomeOpen(false);
    persist({ ...persisted, welcomeSeen: true });
    setTourStepIndex(0);
    setTourActive(true);
    setPanelOpen(false);
  }, [persist, persisted]);

  const endTour = useCallback(
    (completed = true) => {
      setTourActive(false);
      setTourStepIndex(0);
      if (completed) {
        persist({ ...persisted, tourCompleted: true, welcomeSeen: true });
      }
    },
    [persist, persisted]
  );

  const nextTourStep = useCallback(() => {
    const step = COMPANY_GUIDE_TOUR_STEPS[tourStepIndex];
    if (step?.checklistId) markTaskDone(step.checklistId);

    if (tourStepIndex >= COMPANY_GUIDE_TOUR_STEPS.length - 1) {
      endTour(true);
      setPanelOpen(true);
      return;
    }
    setTourStepIndex((i) => i + 1);
  }, [endTour, markTaskDone, tourStepIndex]);

  const prevTourStep = useCallback(() => {
    setTourStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToTourStep = useCallback((index: number) => {
    setTourStepIndex(Math.max(0, Math.min(index, COMPANY_GUIDE_TOUR_STEPS.length - 1)));
  }, []);

  const resetGuide = useCallback(() => {
    const fresh = defaultState();
    persist(fresh);
    setTourStepIndex(0);
    setTourActive(false);
    setWelcomeOpen(true);
  }, [persist]);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const showFirstVisitWelcome = hydrated && Boolean(userId) && !persisted.welcomeSeen;

  const openChecklistItem = useCallback(
    (item: GuideChecklistItem): { tab: CompanyTab; settingsSubTab?: SettingsSubTab } => ({
      tab: item.tab,
      settingsSubTab: item.settingsSubTab,
    }),
    []
  );

  const currentTourStep = tourActive ? COMPANY_GUIDE_TOUR_STEPS[tourStepIndex] : null;

  return {
    hydrated,
    checklist,
    completedCount,
    totalTasks,
    progressPercent,
    panelOpen,
    welcomeOpen,
    tourActive,
    tourStepIndex,
    tourSteps: COMPANY_GUIDE_TOUR_STEPS,
    currentTourStep,
    showFirstVisitWelcome,
    tourCompleted: persisted.tourCompleted,
    markTaskDone,
    toggleTask,
    dismissWelcome,
    startTour,
    endTour,
    nextTourStep,
    prevTourStep,
    goToTourStep,
    resetGuide,
    openPanel,
    closePanel,
    setWelcomeOpen,
    openChecklistItem,
  };
}

export type CompanyGuideApi = ReturnType<typeof useCompanyGuide>;
