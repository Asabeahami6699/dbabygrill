// frontend/src/components/deliveryGuyComponents/hooks/useRoute.ts
import { useState, useEffect } from 'react';

export interface LatLng { lat: number; lng: number; }

const cache = new Map<string, LatLng[]>();

export function useRoute(
  origin: LatLng | null | undefined,
  destination: LatLng | null | undefined,
) {
  const [route, setRoute] = useState<LatLng[]>([]);

  useEffect(() => {
    if (!origin || !destination) { setRoute([]); return; }

    // Round to ~10 m precision so minor GPS jitter doesn't bust the cache
    const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    if (cache.has(key)) { setRoute(cache.get(key)!); return; }

    let cancelled = false;

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const coords: LatLng[] =
          data.routes?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]: [number, number]) => ({ lat, lng })
          ) ?? [];
        cache.set(key, coords);
        setRoute(coords);
      })
      .catch(err => console.error('[useRoute]', err));

    return () => { cancelled = true; };
  }, [
    origin?.lat.toFixed(4),
    origin?.lng.toFixed(4),
    destination?.lat.toFixed(4),
    destination?.lng.toFixed(4),
  ]);

  return route;
}