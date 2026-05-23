import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, updateSessionCache } from '../api/supabase';
import { primeTokenCache } from '../api/authToken';
import { api } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { getPostAuthPath } from '../lib/authRedirect';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser, setUserFromOAuth } = useAuth();
  const [error, setError] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const finishSignIn = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const oauthError =
        hashParams.get('error_description') ||
        searchParams.get('error_description') ||
        hashParams.get('error') ||
        searchParams.get('error');

      if (oauthError) {
        setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
        handledRef.current = true;
        return;
      }

      const { data: { session: initialSession }, error: sessionError } =
        await supabase.auth.getSession();

      let session = initialSession;
      if (!session) {
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 400));
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
        }
      }

      if (sessionError && !session) {
        setError('Google sign-in was cancelled or could not be completed.');
        handledRef.current = true;
        return;
      }

      if (!session?.access_token) {
        setError('Google sign-in was cancelled or could not be completed.');
        handledRef.current = true;
        return;
      }

      updateSessionCache(session);
      primeTokenCache(session.access_token);

      try {
        const { data } = await api.post<{
          success: boolean;
          user: {
            id: string;
            email: string;
            role: string;
            full_name?: string;
            phone?: string;
            company_id?: string;
            company?: unknown;
          };
        }>('/auth/oauth-sync', {}, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        setUserFromOAuth({
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          companyId: data.user.company_id,
          fullName: data.user.full_name,
          phone: data.user.phone,
          company: data.user.company,
        });

        await refreshUser();

        handledRef.current = true;
        const returnTo = searchParams.get('returnTo');
        navigate(getPostAuthPath(data.user.role, returnTo), { replace: true });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || 'Could not finish Google sign-in.';
        setError(message);
        handledRef.current = true;
      }
    };

    finishSignIn();
  }, [navigate, refreshUser, searchParams, setUserFromOAuth]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign-in failed</h1>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-block bg-orange-600 text-white px-6 py-2.5 rounded-lg hover:bg-orange-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex flex-col items-center justify-center px-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4" />
      <p className="text-gray-600">Completing Google sign-in…</p>
    </div>
  );
}
