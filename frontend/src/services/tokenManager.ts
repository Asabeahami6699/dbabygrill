// frontend/src/services/tokenManager.ts
//
// Single token cache shared by both apiClient and AuthContext.
// authToken.ts re-exports from here — never duplicate this logic.

import { getSession, clearSessionCache, supabase } from '../api/supabase';

let cachedToken: string | null = null;
let cachedTokenExp = 0;
let inFlightTokenPromise: Promise<string | null> | null = null;

function getTokenExpiration(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

export function clearTokenCache() {
  cachedToken = null;
  cachedTokenExp = 0;
  inFlightTokenPromise = null;
  // Also clear session cache so the next getSession() call
  // fetches fresh — critical when switching between users
  clearSessionCache();
}

export function primeTokenCache(token: string) {
  cachedToken = token;
  cachedTokenExp = getTokenExpiration(token) || Date.now() + 3_600_000;
}

export async function getValidToken(): Promise<string | null> {
  const now = Date.now();

  // Return cached token if still fresh (>30s before expiry)
  if (cachedToken && cachedTokenExp > now + 30_000) {
    return cachedToken;
  }

  // Deduplicate concurrent calls
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const session = await getSession();

      if (!session?.access_token) {
        clearTokenCache();
        return null;
      }

      const expiry = getTokenExpiration(session.access_token);
      const needsRefresh = expiry > 0 && now >= expiry - 5 * 60_000;

      if (needsRefresh) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          clearTokenCache();
          return null;
        }
        cachedToken = data.session.access_token;
        cachedTokenExp = getTokenExpiration(cachedToken) || now + 3_600_000;
        return cachedToken;
      }

      cachedToken = session.access_token;
      cachedTokenExp = expiry || now + 3_600_000;
      return cachedToken;

    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}