import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { setNetworkNotifier } from '../lib/networkNotifier';

export function useNetworkStatus() {
  const wasOffline = useRef(!navigator.onLine);

  useEffect(() => {
    const showOffline = () => {
      toast.error('No internet connection. Check your network and try again.', {
        id: 'network-offline',
        duration: 5000,
        icon: '📡',
      });
    };

    const showOnline = () => {
      if (wasOffline.current) {
        toast.success('Back online.', { id: 'network-online', duration: 3000, icon: '✓' });
      }
      wasOffline.current = false;
    };

    setNetworkNotifier((message) => {
      toast.error(message, { id: 'network-api-error', duration: 5000, icon: '📡' });
    });

    if (!navigator.onLine) {
      wasOffline.current = true;
      showOffline();
    }

    window.addEventListener('offline', () => {
      wasOffline.current = true;
      showOffline();
    });
    window.addEventListener('online', showOnline);

    return () => {
      window.removeEventListener('offline', showOffline);
      window.removeEventListener('online', showOnline);
      setNetworkNotifier(() => {});
    };
  }, []);
}
