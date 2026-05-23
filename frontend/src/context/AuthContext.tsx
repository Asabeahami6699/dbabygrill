import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, getSession, updateSessionCache, clearSessionCache } from '../api/supabase';
import { clearTokenCache, primeTokenCache, getValidToken } from '../api/authToken';
import { api } from '../services/apiClient';
import { useProfileStore } from '../store/profileStore';

interface User {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  fullName?: string;
  phone?: string;
  company?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  signIn: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  signUp: (email: string, password: string, userData?: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: {
    full_name?: string;
    phone?: string;
    address?: string;
    city?: string;
  }) => Promise<void>;
}

interface SignUpData {
  fullName: string;
  phone?: string;
  role?: string;
  companyName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Roles assigned via admin panel whose user_metadata.role may be stale.
// Never overwrite these with session metadata — always trust /auth/me.
const PRIVILEGED_ROLES = ['delivery_guy', 'company_admin', 'admin'];

function getBasicUserFromSession(session: any): User | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email!,
    role: session.user.user_metadata?.role || 'customer',
    fullName: session.user.user_metadata?.full_name,
    phone: session.user.user_metadata?.phone,
  };
}

async function fetchUserWithRetry(token: string, maxRetries = 3): Promise<any> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      return response.data;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      if (status === 401) throw err;
      if (i < maxRetries) {
        const delay = 2000 * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Concurrent callers (initializeAuth + INITIAL_SESSION) share one in-flight /auth/me
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const initialLoadDoneRef = useRef(false);

  const refreshUser = useCallback(async (retryCount = 0): Promise<void> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const run = async (): Promise<void> => {
      try {
        const token = await getValidToken();
        if (!token) {
          setUser(null);
          return;
        }

        const userData = await fetchUserWithRetry(token, 3);

        setUser({
          id: userData.id,
          email: userData.email,
          role: userData.role,
          companyId: userData.company_id,
          fullName: userData.full_name,
          phone: userData.phone,
          company: userData.company,
        });
      } catch (error: any) {
        console.error('Refresh user error:', error);
        const status = error?.response?.status;
        if (status === 401) {
          clearTokenCache();
          clearSessionCache();
          setUser(null);
        } else if (retryCount < 5) {
          setTimeout(() => refreshUser(retryCount + 1), 3000 * (retryCount + 1));
        }
      }
    };

    refreshPromiseRef.current = run().finally(() => {
      refreshPromiseRef.current = null;
    });
    return refreshPromiseRef.current;
  }, []);

  const updateProfile = async (data: {
    full_name?: string;
    phone?: string;
    address?: string;
    city?: string;
  }) => {
    const token = await getValidToken();
    if (!token) throw new Error('Not authenticated');
    await api.put('/auth/profile', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await refreshUser();
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const session = await getSession();
        if (session?.access_token) {
          primeTokenCache(session.access_token);
        }
        // Do NOT set user from Supabase metadata here — delivery guys often have
        // user_metadata.role = 'customer'. Wait for /auth/me so ProtectedRoute
        // never sees a stale role on refresh.
        if (session?.user && isMounted) {
          await refreshUser();
          initialLoadDoneRef.current = true;
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsAuthReady(true);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        updateSessionCache(session ?? null);

        if (event === 'TOKEN_REFRESHED') {
          if (session?.access_token) primeTokenCache(session.access_token);
          return;
        }

        if (event === 'SIGNED_OUT') {
          clearTokenCache();
          clearSessionCache();
          setUser(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          if (session.access_token) primeTokenCache(session.access_token);
          // Preserve privileged role set by signIn() — don't overwrite with
          // stale user_metadata (delivery guys have metadata.role = 'customer')
          setUser(prev => {
            if (prev?.id === session.user!.id && PRIVILEGED_ROLES.includes(prev.role)) {
              return prev;
            }
            return getBasicUserFromSession(session);
          });
          if (isMounted) await refreshUser();
          setLoading(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          if (session?.user && session?.access_token) {
            primeTokenCache(session.access_token);
            updateSessionCache(session);
            if (!initialLoadDoneRef.current && isMounted) {
              await refreshUser();
              initialLoadDoneRef.current = true;
            }
          }
          // Only mark ready after initializeAuth or this handler finished /auth/me
          if (isMounted && initialLoadDoneRef.current) {
            setLoading(false);
            setIsAuthReady(true);
          }
          return;
        }

        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const signIn = async (email: string, password: string, turnstileToken?: string) => {
    let response;
    try {
      response = await api.post('/auth/signin', { email, password, turnstileToken });
    } catch (err: any) {
      const data = err?.response?.data;
      const message = data?.error || err.message || 'Sign in failed';
      const error = new Error(message) as Error & { code?: string };
      error.code = data?.code;
      throw error;
    }
    const data = response.data;

    if (data.session?.access_token) {
      updateSessionCache(data.session);
      primeTokenCache(data.session.access_token);
    }

    // Set authoritative user BEFORE setSession triggers SIGNED_IN event
    setUser({
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      companyId: data.user.company_id,
      fullName: data.user.full_name,
      phone: data.user.phone,
      company: data.user.company,
    });

    await supabase.auth.setSession(data.session);
  };

  const signUp = async (email: string, password: string, userData?: SignUpData) => {
    await api.post('/auth/signup', {
      email,
      password,
      fullName: userData?.fullName,
      phone: userData?.phone,
      role: userData?.role || 'customer',
      companyName: userData?.companyName,
    });
  };

  const signOut = async () => {
    // Wipe ALL caches before anything else — prevents the old user's token
    // from being sent during the next login flow
    clearTokenCache();   // also calls clearSessionCache() internally
    useProfileStore.getState().invalidateCache();
    setUser(null);

    // Tell backend (fire and forget)
    api.post('/auth/signout').catch(() => {});

    // Terminate the Supabase session on the client
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthReady, signIn, signUp, signOut, refreshUser, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};