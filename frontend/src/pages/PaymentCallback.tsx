// frontend/src/pages/PaymentCallback.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { api } from '../services/apiClient';

type Status = 'verifying' | 'success' | 'failed';

const INITIAL_DELAY  = 6000;   // Wait 6s before first poll — webhook typically arrives in 5–15s
const POLL_INTERVAL  = 3000;   // 3 seconds between polls
const MAX_POLLS      = 80;     // ~4 minutes total after initial delay

export default function PaymentCallback() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const clearCart      = useCartStore((s) => s.clearCart);

  const [status,  setStatus]  = useState<Status>('verifying');
  const [message, setMessage] = useState('Waiting for payment confirmation... (usually takes 10–15 seconds)');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [manualCheckLoading, setManualCheckLoading] = useState(false);

  const polls   = useRef(0);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive   = useRef(true);

  // Capture reference from URL (Paystack may use 'reference' or 'trxref')
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const fail = useCallback((msg: string) => {
    if (!alive.current) return;
    setStatus('failed');
    setMessage(msg);
  }, []);

  // Shared function to check order status — no auth, pure DB read, fast
  const checkOrderStatus = useCallback(async (): Promise<boolean> => {
    if (!reference) return false;
    try {
      const { data } = await api.get<{
        status: string;
        orderId?: string;
        orderNumber?: string;
      }>(`/payments/status/${encodeURIComponent(reference)}`);

      if (data.status === 'paid') {
        try { await clearCart(); } catch { /* ignored */ }
        setOrderId(data.orderId!);
        setStatus('success');
        setMessage(`Order #${data.orderNumber} confirmed!`);
        if (timer.current) clearTimeout(timer.current);
        setTimeout(() => navigate(`/orders/${data.orderId}`, { replace: true }), 2000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Status check error:', err);
      return false;
    }
  }, [reference, clearCart, navigate]);

  // Manual check (triggered by button)
  const handleManualCheck = async () => {
    if (manualCheckLoading) return;
    setManualCheckLoading(true);
    const success = await checkOrderStatus();
    if (!success && alive.current) {
      setMessage(
        `Order still not found. Reference: ${reference}. Please wait a moment and try again, or contact support.`
      );
    }
    setManualCheckLoading(false);
  };

  // Polling effect — starts after INITIAL_DELAY to give the webhook time to arrive
  useEffect(() => {
    alive.current = true;

    if (!reference) {
      fail('No payment reference found. Please contact support.');
      return;
    }

    const poll = async () => {
      if (!alive.current) return;

      polls.current += 1;
      const n = polls.current;

      // After the first poll, show elapsed time so the user knows it's working
      if (n > 1) {
        const elapsed = Math.floor((INITIAL_DELAY + n * POLL_INTERVAL) / 1000);
        setMessage(`Confirming your order... (${elapsed}s)`);
      }

      const orderFound = await checkOrderStatus();
      if (orderFound) return; // success — polling stops

      if (n >= MAX_POLLS) {
        fail(
          'Your payment was received but the order is taking longer than expected. ' +
          'You can try checking manually using the button below. ' +
          `Reference: ${reference}`
        );
        return;
      }

      timer.current = setTimeout(poll, POLL_INTERVAL);
    };

    // Wait for INITIAL_DELAY before first poll.
    // This is the key fix: Paystack webhooks typically arrive 5–15s after the
    // customer is redirected back. Polling immediately wastes requests and
    // lets the elapsed counter climb before the order can possibly exist.
    timer.current = setTimeout(poll, INITIAL_DELAY);

    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reference, checkOrderStatus, fail]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">

        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Processing Payment</h2>
            <p className="text-gray-500 text-sm mt-2">{message}</p>
            <p className="text-xs text-gray-400 mt-3">Please do not close this page.</p>
            {reference && (
              <p className="mt-4 text-xs text-gray-400 font-mono break-all">Ref: {reference}</p>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Successful!</h2>
            <p className="text-gray-500 text-sm mt-2">{message}</p>
            <p className="text-xs text-gray-400 mt-1">Redirecting to your order...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Status</h2>
            <p className="text-gray-500 text-sm mt-2">{message}</p>
            {reference && (
              <p className="mt-3 text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 break-all">
                Ref: {reference}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate('/cart')}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                Back to Cart
              </button>
              <button
                onClick={handleManualCheck}
                disabled={manualCheckLoading}
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50"
              >
                {manualCheckLoading ? 'Checking...' : 'Check Status Manually'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}