import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import TurnstileWidget, { isTurnstileEnabled } from '../components/TurnstileWidget';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || '/';
  const returnTo = location.state?.returnTo || from;
  const checkoutMessage = location.state?.message;

  useEffect(() => {
    if (checkoutMessage) {
      console.log('Message from checkout:', checkoutMessage);
    }
  }, [checkoutMessage]);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'delivery_guy') {
      navigate('/delivery/dashboard', { replace: true });
    } else if (user.role === 'company_admin') {
      navigate('/company/dashboard', { replace: true });
    } else if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (returnTo === '/checkout') {
      navigate('/checkout', { replace: true });
    } else {
      navigate(returnTo !== '/' ? returnTo : '/', { replace: true });
    }
  }, [user, navigate, returnTo]);

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setResendLoading(true);
    try {
      const { data } = await api.post('/auth/resend-verification', { email: email.trim() });
      toast.success(data.message || 'Verification email sent.');
      setError('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not send verification email.';
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailNotVerified(false);

    if (isTurnstileEnabled() && !turnstileToken) {
      setError('Please complete the security check below.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password, turnstileToken || undefined);
    } catch (err: any) {
      const code = err?.code;
      const errorMsg = (err.message || '').toLowerCase();

      if (code === 'EMAIL_NOT_VERIFIED' || errorMsg.includes('verify your email')) {
        setEmailNotVerified(true);
        setError('Please verify your email before signing in. Check your inbox for the confirmation link.');
      } else if (errorMsg.includes('user') || errorMsg.includes('email') || errorMsg.includes('not found')) {
        setError('No account found with this email address');
      } else if (errorMsg.includes('password') || errorMsg.includes('invalid')) {
        setError('Invalid email or password');
      } else if (errorMsg.includes('security')) {
        setError(err.message);
      } else {
        setError(err.message || 'Invalid email or password');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-orange-600">DBaby Grills</h1>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-gray-600">Sign in to your account</p>

          {checkoutMessage && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2">
              <p className="text-orange-700 text-sm">{checkoutMessage}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
              {emailNotVerified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="mt-2 text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
                >
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-4h12a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <TurnstileWidget
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              className="flex justify-center"
            />

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-orange-600 hover:text-orange-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>

          {returnTo === '/checkout' && (
            <div className="mt-4 text-center">
              <Link
                to="/cart"
                className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
              >
                ← Back to Cart
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
