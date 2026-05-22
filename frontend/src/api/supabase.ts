import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'app-auth-token',
  },
});

let cachedSession: Session | null = null;
let sessionExp = 0;
let inFlightSession: Promise<Session | null> | null = null;

export function updateSessionCache(session: Session | null) {
  cachedSession = session;
  sessionExp = session ? Date.now() + 55_000 : 0;
  inFlightSession = null;
}

export async function getSession(): Promise<Session | null> {
  const now = Date.now();

  if (cachedSession && sessionExp > now) {
    return cachedSession;
  }

  if (inFlightSession) {
    return inFlightSession;
  }

  inFlightSession = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error(error.message);
        return null;
      }

      cachedSession = data.session;
      sessionExp = data.session ? now + 55_000 : 0;

      return data.session;
    } finally {
      inFlightSession = null;
    }
  })();

  return inFlightSession;
}

export function clearSessionCache() {
  cachedSession = null;
  sessionExp = 0;
  inFlightSession = null;
}