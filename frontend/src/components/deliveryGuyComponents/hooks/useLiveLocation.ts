// frontend/src/components/deliveryGuyComponents/hooks/useLiveLocation.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { getValidToken } from '../../../api/authToken';
import { api } from '../../../services/apiClient'; // ✅ backend API client

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
}

interface UseLiveLocationOptions {
  deliveryGuyId: string | undefined;
  orderId?: string | null;
  isTracking: boolean;
}

const UPDATE_THROTTLE_MS = 10_000;
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 5_000,
};

export function useLiveLocation({ deliveryGuyId, orderId, isTracking }: UseLiveLocationOptions) {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permitted, setPermitted] = useState<boolean | null>(null);

  const watchId = useRef<number | null>(null);
  const lastPushAt = useRef<number>(0);
  const isMounted = useRef(true);
  const locationRef = useRef<LocationState | null>(null);

  // Keep ref in sync
  useEffect(() => { locationRef.current = location; }, [location]);

  // ── Push location through backend API ────────────────────────
  const pushLocation = useCallback(async (pos: LocationState) => {
    if (!deliveryGuyId) return;
    const now = Date.now();
    if (now - lastPushAt.current < UPDATE_THROTTLE_MS) return;
    lastPushAt.current = now;

    try {
      const token = await getValidToken();
      await api.post('/delivery/location', {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        heading: pos.heading,
        speed: pos.speed,
        is_online: true,
        ...(orderId ? { order_id: orderId } : {}),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('[useLiveLocation] backend push error:', err);
    }
  }, [deliveryGuyId, orderId]);

  // ── Mark offline through backend API ─────────────────────────
  const markOffline = useCallback(async () => {
    if (!deliveryGuyId) return;
    try {
      const token = await getValidToken();
      const lastPos = locationRef.current;
      await api.post('/delivery/location', {
        // Send last known coordinates, or zeros (backend requires lat/lng)
        latitude: lastPos?.latitude ?? 0,
        longitude: lastPos?.longitude ?? 0,
        is_online: false,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('[useLiveLocation] markOffline error:', err);
    }
  }, [deliveryGuyId]);

  // ── Main GPS watch effect (unchanged) ────────────────────────
  useEffect(() => {
    isMounted.current = true;

    if (!isTracking || !deliveryGuyId) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (!isTracking) markOffline();
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('GPS is not supported on this device.');
      setPermitted(false);
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMounted.current) return;
        setPermitted(true);
        setError(null);

        const loc: LocationState = {
          latitude:  position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy:  position.coords.accuracy,
          heading:   position.coords.heading,
          speed:     position.coords.speed,
        };

        setLocation(loc);
        pushLocation(loc);
      },
      (err) => {
        if (!isMounted.current) return;
        setPermitted(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Enable GPS to share your location.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Check your GPS signal.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Retrying...');
            break;
          default:
            setError('Could not get location.');
        }
      },
      GEO_OPTIONS
    );

    return () => {
      isMounted.current = false;
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isTracking, deliveryGuyId, pushLocation, markOffline]);

  return { location, error, permitted };
}