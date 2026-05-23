import React from 'react';
import { Company } from './hooks/useCompanyData';
import NotificationBell from './NotificationBell';

interface CompanyHeaderProps {
  company: Company | null;
  onAddItem: () => void;
  onRefresh: () => void;        // new prop
  isRefreshing?: boolean;       // optional loading indicator
  realtimeMode?: 'connecting' | 'realtime' | 'polling';
  onOpenOrderFromNotification?: (orderId: string) => void;
}

export default function CompanyHeader({
  company,
  onAddItem,
  onRefresh,
  isRefreshing,
  realtimeMode = 'connecting',
  onOpenOrderFromNotification,
}: CompanyHeaderProps) {
  const connectionClass =
    realtimeMode === 'realtime'
      ? 'bg-green-100 text-green-700'
      : realtimeMode === 'polling'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600';

  const connectionLabel =
    realtimeMode === 'realtime'
      ? 'Live'
      : realtimeMode === 'polling'
        ? 'Fallback'
        : 'Connecting';
  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 md:left-64 z-20">
      <div className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800">
              {company?.name || 'Loading...'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500 hidden sm:block">{company?.location || ''}</p>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${connectionClass}`}>
                {connectionLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              data-guide="add-item"
              onClick={onAddItem}
              className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-1 sm:gap-2 text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Item</span>
            </button>

            <div data-guide="notifications">
              <NotificationBell onOpenOrder={onOpenOrderFromNotification} />
            </div>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 disabled:opacity-50"
              title="Refresh data"
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {company?.name?.charAt(0) || 'G'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}