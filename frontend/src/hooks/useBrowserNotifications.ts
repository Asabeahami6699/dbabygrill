import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/** Request browser push permission once per session when user is logged in (free Web Notifications API). */
export function useBrowserNotifications() {
  const { user, isAuthReady } = useAuth();

  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'default') return;

    window.Notification.requestPermission().catch(() => {});
  }, [isAuthReady, user?.id]);
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    new window.Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // ignore — e.g. insecure context
  }
}
