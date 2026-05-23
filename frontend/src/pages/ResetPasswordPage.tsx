import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabase';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    const verifySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const isRecovery =
        hashParams.get('type') === 'recovery' || hashParams.has('access_token');

      for (let i = 0; i < 6; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) {
            setReady(true);
            setChecking(false);
          }
          return;
        }
        if (!isRecovery && i === 0) break;
        await new Promise((r) => setTimeout(r, 400));
      }

      if (mounted) {
        setChecking(false);
        if (!ready) {
          setError('This reset link is invalid or has expired. Request a new one.');
        }
      }
    };

    verifySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [ready]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated successfully. Please sign in.' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update password.';
      setError(msg);
    } finally {
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
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Set a new password</h2>
          <p className="mt-2 text-gray-600 text-sm">Choose a strong password for your account.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {checking ? (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mb-3" />
              <p className="text-gray-500 text-sm">Verifying reset link…</p>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-4">
              <p className="text-red-600 text-sm">{error}</p>
              <Link
                to="/forgot-password"
                className="inline-block bg-orange-600 text-white px-6 py-2.5 rounded-lg hover:bg-orange-700 font-medium text-sm"
              >
                Request new link
              </Link>
              <p>
                <Link to="/login" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                    placeholder="Repeat password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
