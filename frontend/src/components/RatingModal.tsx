// src/components/RatingModal.tsx
import { useState } from 'react';
import { supabase } from '../api/supabase';
import { toast } from 'react-hot-toast';
import { api } from '../services/apiClient'; // ✅ axios instance pointing to Render

interface RatingModalProps {
  isOpen: boolean;
  orderId: string;
  orderNumber: string;
  companyName: string;
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RatingModal({
  isOpen,
  orderId,
  orderNumber,
  companyName,
  productId,
  productName,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
  setIsSubmitting(true);

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    await api.post(
      '/orders/reviews',
      {
        orderId,
        productId,
        rating,
        reviewText
      },
      {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      }
    );

    toast.success('Thank you for your review!');

    onSuccess();
    onClose();

    setRating(5);
    setReviewText('');
  } catch (error: any) {
    console.error('Error submitting review:', error);

    toast.error(
      error.response?.data?.message ||
      error.message ||
      'Failed to submit review'
    );
  } finally {
    setIsSubmitting(false);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Rate Your Experience</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 mb-4">
          How was your experience with <span className="font-semibold">{companyName}</span>?
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Order #{orderNumber.slice(0, 8)}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Product: <span className="font-semibold text-gray-700">{productName}</span>
        </p>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <svg
                className={`w-10 h-10 ${
                  star <= (hoverRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                } transition-colors`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>

        {/* Rating Labels */}
        <div className="flex justify-between text-xs text-gray-500 mb-6">
          <span>Poor</span>
          <span>Fair</span>
          <span>Good</span>
          <span>Very Good</span>
          <span>Excellent</span>
        </div>

        {/* Review Text */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Share your experience (Optional)
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Tell us about your order. Was the food delicious? Was delivery on time?"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 resize-none"
          />
        </div>

        {/* Quick Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['Delicious food', 'Fast delivery', 'Great packaging', 'Good value', 'Friendly service', 'Will order again'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setReviewText(prev => prev ? `${prev}, ${tag}` : tag)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              'Submit Review'
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}