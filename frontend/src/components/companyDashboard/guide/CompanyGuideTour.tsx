import { useEffect, useLayoutEffect, useState } from 'react';
import { GuideTourStep } from './companyGuideData';
import type { CompanyGuideApi } from './useCompanyGuide';

interface CompanyGuideTourProps {
  guide: CompanyGuideApi;
  onNavigate: (step: GuideTourStep) => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function CompanyGuideTour({ guide, onNavigate }: CompanyGuideTourProps) {
  const step = guide.currentTourStep;
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!step || !guide.tourActive) return;
    onNavigate(step);
  }, [step?.id, guide.tourActive, onNavigate]);

  useLayoutEffect(() => {
    if (!step || !guide.tourActive) {
      setSpotlight(null);
      return;
    }

    const isCenter = step.placement === 'center' || !step.target;

    if (isCenter) {
      setSpotlight(null);
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(420px, calc(100vw - 2rem))',
        zIndex: 10002,
      });
      return;
    }

    const update = () => {
      const el = document.querySelector(step.target!);
      if (!el) {
        setSpotlight(null);
        setTooltipStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: 'min(420px, calc(100vw - 2rem))',
          zIndex: 10002,
        });
        return;
      }

      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const rect = el.getBoundingClientRect();
      const pad = 8;
      setSpotlight({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });

      const gap = 12;
      const maxW = Math.min(400, window.innerWidth - 24);
      let top = rect.bottom + gap;
      let left = rect.left;

      if (step.placement === 'top') {
        top = rect.top - gap;
      } else if (step.placement === 'left') {
        left = rect.left - maxW - gap;
        top = rect.top;
      } else if (step.placement === 'right') {
        left = rect.right + gap;
        top = rect.top;
      }

      if (left + maxW > window.innerWidth - 12) {
        left = window.innerWidth - maxW - 12;
      }
      if (left < 12) left = 12;
      if (top > window.innerHeight - 200) {
        top = Math.max(12, rect.top - 180);
      }

      setTooltipStyle({
        position: 'fixed',
        top,
        left,
        maxWidth: maxW,
        zIndex: 10002,
      });
    };

    const t = window.setTimeout(update, 120);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step, guide.tourActive, guide.tourStepIndex]);

  if (!guide.tourActive || !step) return null;

  const stepNum = guide.tourStepIndex + 1;
  const total = guide.tourSteps.length;
  const isLast = guide.tourStepIndex >= total - 1;

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Dashboard tour">
      <div
        className="absolute inset-0 bg-black/55 transition-opacity"
        onClick={() => guide.endTour(false)}
      />

      {spotlight && (
        <div
          className="absolute rounded-lg ring-4 ring-orange-500 ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            zIndex: 10001,
          }}
        />
      )}

      <div
        className="bg-white rounded-xl shadow-2xl p-5 border border-orange-100"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-orange-600 mb-1">
          Step {stepNum} of {total}
        </p>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.body}</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => guide.endTour(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={guide.tourStepIndex === 0}
              onClick={guide.prevTourStep}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={guide.nextTourStep}
              className="px-4 py-1.5 text-sm rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {guide.tourSteps.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => guide.goToTourStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === guide.tourStepIndex ? 'bg-orange-600' : 'bg-gray-200 hover:bg-orange-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
