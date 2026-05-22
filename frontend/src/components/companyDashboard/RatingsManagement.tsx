// frontend/src/components/companyDashboard/RatingsManagement.tsx
import { useState, useMemo } from 'react';
import { useRealtimeRatings } from './hooks/useRealtimeRatings';
import { api } from '../../services/apiClient';
import { getValidToken } from '../../api/authToken';
import { useRatingsStore } from './comDashStore/ratingsStore';

interface RatingsManagementProps {
  companyId?: string;
}

type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'custom';
type ResolutionFilter = 'all' | 'resolved' | 'unresolved';

export default function RatingsManagement({ companyId }: RatingsManagementProps) {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>('all');
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [resolvingReviewId, setResolvingReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});

  // Compute date range
  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (datePreset) {
      case 'today':
        return { start: todayStart, end: todayEnd };
      case 'week': {
        const weekStart = new Date(now);
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        weekStart.setDate(now.getDate() + diffToMonday);
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: todayEnd };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return { start: monthStart, end: todayEnd };
      }
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate + 'T23:59:59'),
          };
        }
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
  };

  const { start, end } = getDateRange();
  const { ratings, loading, error, refetch } = useRealtimeRatings({ companyId, startDate: start, endDate: end });

  // Flatten and filter reviews by resolution status
  const allReviews = useMemo(() => {
    const flattened = ratings.flatMap((p) =>
      p.recentReviews.map((r) => ({ ...r, productId: p.productId, productName: p.productName }))
    );
    if (resolutionFilter === 'resolved') {
      return flattened.filter((r) => r.issueResolved === true);
    }
    if (resolutionFilter === 'unresolved') {
      return flattened.filter((r) => r.issueResolved === false);
    }
    return flattened;
  }, [ratings, resolutionFilter]);

  const handleRespond = async (reviewId: string) => {
    const text = (replyDraftByReviewId[reviewId] || '').trim();
    if (!text) return;
    setSavingReviewId(reviewId);
    try {
      const token = await getValidToken();
      await api.patch(
        `/orders/reviews/${reviewId}/respond`,
        { response: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyDraftByReviewId((prev) => ({ ...prev, [reviewId]: '' }));
      await refetch();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleResolveStatus = async (reviewId: string, resolved: boolean) => {
    setResolvingReviewId(reviewId);
    try {
      const token = await getValidToken();
      await api.patch(
        `/orders/reviews/${reviewId}/resolve`,
        { resolved },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refetch();
    } catch (err: any) {
      console.error(err);
    } finally {
      setResolvingReviewId(null);
    }
  };

  const datePresets: { value: DateRangePreset; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom' },
  ];

  const resolutionOptions: { value: ResolutionFilter; label: string }[] = [
    { value: 'all', label: 'All Reviews' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'unresolved', label: 'Unresolved' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Ratings & Feedback</h2>
      </div>

      {/* Date Filter Row */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Filter by date:</span>
        <div className="flex flex-wrap gap-2">
          {datePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => {
                setDatePreset(preset.value);
                if (preset.value !== 'custom') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                datePreset === preset.value
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-0 sm:ml-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-gray-500">—</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setDatePreset('all');
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resolution Filter Row */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Resolution status:</span>
        <div className="flex flex-wrap gap-2">
          {resolutionOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setResolutionFilter(option.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                resolutionFilter === option.value
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading ratings...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && allReviews.length === 0 && (
        <div className="bg-white rounded-xl p-6 text-sm text-gray-500">
          No ratings match the selected filters.
        </div>
      )}

      {!loading && !error && allReviews.length > 0 && (
        <div className="space-y-4">
          {allReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-gray-900">{review.productName}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    review.rating <= 2
                      ? 'bg-red-100 text-red-700'
                      : review.rating >= 4
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {review.rating}/5
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    review.issueResolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {review.issueResolved ? 'Resolved' : 'Unresolved'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-2">
                {review.customerName} • {new Date(review.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-700 mb-3">{review.reviewText || 'No comment provided.'}</p>

              {review.ownerResponse ? (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-800">
                  <span className="font-medium">Your response:</span> {review.ownerResponse}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={replyDraftByReviewId[review.id] || ''}
                    onChange={(e) => setReplyDraftByReviewId(prev => ({ ...prev, [review.id]: e.target.value }))}
                    placeholder="Send feedback to this customer..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleRespond(review.id)}
                    disabled={savingReviewId === review.id}
                    className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {savingReviewId === review.id ? 'Sending...' : 'Send feedback'}
                  </button>
                </div>
              )}

              <div className="mt-2">
                <button
                  onClick={() => handleResolveStatus(review.id, !review.issueResolved)}
                  disabled={resolvingReviewId === review.id}
                  className={`px-3 py-1.5 text-xs rounded-lg ${
                    review.issueResolved
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {resolvingReviewId === review.id ? 'Saving...' : review.issueResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}