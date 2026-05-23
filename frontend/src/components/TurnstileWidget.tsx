import { useEffect, useRef, useCallback } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
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

export default function TurnstileWidget({ onToken, onExpire, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);

  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
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
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onExpireRef.current?.(),
        });
      })
      .catch((err) => console.error('[Turnstile]', err));

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
    <div className={className}>
      <p className="text-sm font-medium text-gray-700 mb-2">Verify you are human</p>
      <div ref={containerRef} className="flex justify-center min-h-[65px]" />
      <button
        type="button"
        onClick={reset}
        className="mt-1 text-xs text-gray-500 hover:text-orange-600"
      >
        Refresh security check
      </button>
    </div>
  );
}

export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY?.trim());
}
