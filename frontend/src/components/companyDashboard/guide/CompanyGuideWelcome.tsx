import type { CompanyGuideApi } from './useCompanyGuide';

interface CompanyGuideWelcomeProps {
  guide: CompanyGuideApi;
}

export default function CompanyGuideWelcome({ guide }: CompanyGuideWelcomeProps) {
  if (!guide.welcomeOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-welcome-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h2 id="guide-welcome-title" className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to your dashboard
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          We’ll walk you through orders, menu setup, delivery areas, and settings. The setup checklist
          stays in the guide panel so you can finish at your own pace.
        </p>
        <ul className="text-sm text-gray-700 space-y-2 mb-6">
          <li className="flex gap-2">
            <span className="text-orange-600 font-bold">1.</span>
            Take a quick guided tour (about 2 minutes)
          </li>
          <li className="flex gap-2">
            <span className="text-orange-600 font-bold">2.</span>
            Complete the setup checklist
          </li>
          <li className="flex gap-2">
            <span className="text-orange-600 font-bold">3.</span>
            Start receiving and processing orders
          </li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={guide.startTour}
            className="flex-1 py-2.5 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700"
          >
            Start guided tour
          </button>
          <button
            type="button"
            onClick={() => {
              guide.dismissWelcome();
              guide.openPanel();
            }}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            View checklist only
          </button>
        </div>
        <button
          type="button"
          onClick={guide.dismissWelcome}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
