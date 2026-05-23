import { useEffect, useRef, useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/** Cloudflare dummy keys — localhost only; use real widget keys in production. */
export function isTurnstileTestSiteKey(key?: string) {
  const k = (key || SITE_KEY || '').trim();
  return /^[123]x0{16}/.test(k);
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (errorCode?: string) => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile script failed'));
    document.head.appendChild(script);
  });
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

function turnstileErrorHint(errorCode?: string): string {
  const code = String(errorCode || '');
  if (code.startsWith('110')) {
    return 'Turnstile is not configured for this domain. In Cloudflare → Turnstile → your widget → Hostnames, add dbabygrill-frontend.vercel.app (and redeploy with the matching site key).';
  }
  if (isTurnstileTestSiteKey() && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return 'Production is using a Turnstile test site key. Create a real widget in Cloudflare and set VITE_TURNSTILE_SITE_KEY on Vercel plus TURNSTILE_SECRET_KEY on Render.';
  }
  return 'Security check failed. Refresh the page, disable ad blockers, or try another browser.';
}

export default function TurnstileWidget({ onToken, onExpire, className = '' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const [loadError, setLoadError] = useState<string | null>(null);

  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
    setLoadError(null);
    onTokenRef.current('');
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY?.trim() || !containerRef.current) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY.trim(),
          theme: 'light',
          size: 'normal',
          callback: (token) => {
            setLoadError(null);
            onTokenRef.current(token);
          },
          'expired-callback': () => {
            setLoadError(null);
            onExpireRef.current?.();
          },
          'error-callback': (errorCode) => {
            const hint = turnstileErrorHint(errorCode);
            console.error('[Turnstile] error', errorCode, hint);
            setLoadError(hint);
            onExpireRef.current?.();
          },
        });
      })
      .catch((err) => {
        console.error('[Turnstile]', err);
        setLoadError('Could not load Cloudflare Turnstile. Check your network or ad blocker.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY?.trim()) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-gray-700">Verify you are human</p>
        <button
          type="button"
          onClick={reset}
          aria-label="Refresh security check"
          title="Refresh security check"
          className="shrink-0 p-2 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 border border-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="flex justify-center overflow-hidden">
        <div
          ref={containerRef}
          className="w-[300px] max-w-full shrink-0 min-h-[65px]"
        />
      </div>
      {loadError && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 leading-relaxed">
          {loadError}
        </p>
      )}
    </div>
  );
}

export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY?.trim());
}
