export interface AccuratePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const GHANA_BOUNDS = {
  minLat: 4.5,
  maxLat: 11.5,
  minLng: -3.5,
  maxLng: 1.5,
};

export function isInGhana(lat: number, lng: number): boolean {
  return (
    lat >= GHANA_BOUNDS.minLat &&
    lat <= GHANA_BOUNDS.maxLat &&
    lng >= GHANA_BOUNDS.minLng &&
    lng <= GHANA_BOUNDS.maxLng
  );
}

/**
 * Collect several GPS readings and return the most accurate fix.
 * Single getCurrentPosition() is often wrong indoors (Wi‑Fi / IP guess).
 */
export function getAccuratePosition(options?: {
  maxWaitMs?: number;
  targetAccuracyM?: number;
}): Promise<AccuratePosition> {
  const maxWaitMs = options?.maxWaitMs ?? 22_000;
  const targetAccuracyM = options?.targetAccuracyM ?? 40;

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GPS is not supported on this device.'));
      return;
    }

    let best: GeolocationPosition | null = null;
    let settled = false;

    const finish = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    };

    const fail = (err: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) {
        finish(best);
        return;
      }
      if (err.code === err.PERMISSION_DENIED) {
        reject(new Error('Location permission denied. Allow GPS in browser settings.'));
      } else if (err.code === err.TIMEOUT) {
        reject(
          new Error(
            'GPS timed out. Move near a window, wait a few seconds, or use street address instead.'
          )
        );
      } else {
        reject(new Error('Could not get GPS fix. Try again or enter your street address.'));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        if (pos.coords.accuracy <= targetAccuracyM) {
          finish(pos);
        }
      },
      fail,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: maxWaitMs,
      }
    );

    const timer = setTimeout(() => {
      if (settled) return;
      if (best) {
        finish(best);
      } else {
        settled = true;
        navigator.geolocation.clearWatch(watchId);
        reject(
          new Error(
            'GPS is taking too long. Try outdoors, disable VPN, or use street + landmark instead.'
          )
        );
      }
    }, maxWaitMs);
  });
}

export function formatAccuracyHint(accuracyM: number): string {
  if (accuracyM <= 25) return 'High accuracy GPS fix.';
  if (accuracyM <= 80) return 'Moderate accuracy — drag the pin on the map if needed.';
  if (accuracyM <= 200) return 'Low accuracy (often Wi‑Fi). Drag the pin to your exact spot.';
  return 'Very low accuracy. Please drag the pin to your delivery location.';
}
