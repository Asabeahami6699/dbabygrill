import type { CompanyGuideApi } from './useCompanyGuide';

interface CompanyGuidePanelProps {
  guide: CompanyGuideApi;
  onGoToTask: (taskId: string) => void;
}

export default function CompanyGuidePanel({ guide, onGoToTask }: CompanyGuidePanelProps) {
  if (!guide.panelOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-[90] md:hidden"
        onClick={guide.closePanel}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[91] flex flex-col border-l border-gray-200"
        aria-label="Setup guide"
      >
        <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-orange-50 to-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Setup guide</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Get your restaurant ready to receive orders
            </p>
          </div>
          <button
            type="button"
            onClick={guide.closePanel}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close guide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Progress</span>
            <span className="text-orange-600 font-semibold">
              {guide.completedCount}/{guide.totalTasks}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-600 rounded-full transition-all duration-300"
              style={{ width: `${guide.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {guide.checklist.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 transition-colors ${
                item.done ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white hover:border-orange-200'
              }`}
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => guide.toggleTask(item.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.done
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-300 hover:border-orange-500'
                  }`}
                  aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item.done && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-semibold ${item.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.description}</p>
                  <button
                    type="button"
                    onClick={() => onGoToTask(item.id)}
                    className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    Go to section →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-2 bg-gray-50">
          <button
            type="button"
            onClick={guide.startTour}
            className="w-full py-2.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700"
          >
            {guide.tourCompleted ? 'Replay dashboard tour' : 'Start guided tour'}
          </button>
          <button
            type="button"
            onClick={guide.resetGuide}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Reset guide progress
          </button>
        </div>
      </aside>
    </>
  );
}
