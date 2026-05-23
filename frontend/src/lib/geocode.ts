// src/lib/geocode.ts
const cache = new Map<string, { lat: number; lng: number } | null>();
const reverseCache = new Map<string, ReverseGeocodeResult | null>();

function buildQuery(address: string): string {
  const lower = address.toLowerCase();
  const hasMajor =
    lower.includes('ghana')  ||
    lower.includes('accra')  ||
    lower.includes('kumasi') ||
    lower.includes('tema')   ||
    lower.includes('takoradi');

  return hasMajor ? address : `${address}, Accra, Ghana`;
}

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const query = buildQuery(address.trim());

  if (cache.has(query)) return cache.get(query)!;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json` +
      `&q=${encodeURIComponent(query)}` +
      `&limit=1` +
      `&countrycodes=gh` +
      `&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'DBabyGrillsDeliveryApp/1.0',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      cache.set(query, null);
      return null;
    }

    const data = await res.json();

    if (!data?.[0]) {
      cache.set(query, null);
      return null;
    }

    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    cache.set(query, result);
    return result;
  } catch (err) {
    console.error('[geocode] error:', err);
    cache.set(query, null);
    return null;
  }
}

export interface ReverseGeocodeResult {
  displayName: string;
  city: string;
  region: string;
  streetAddress: string;
}

/** Resolve GPS coordinates to a readable address (Ghana-focused). */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'DBabyGrillsDeliveryApp/1.0',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      reverseCache.set(key, null);
      return null;
    }

    const data = await res.json();
    const addr = data?.address || {};
    const city =
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.city_district ||
      addr.town ||
      addr.city ||
      addr.village ||
      addr.county ||
      '';
    const region = addr.state || addr.region || 'Ghana';
    const road =
      addr.road ||
      addr.pedestrian ||
      addr.footway ||
      addr.residential ||
      '';
    const house = addr.house_number || '';
    const streetPart = [house, road].filter(Boolean).join(' ').trim();
    const locality = [addr.suburb, addr.neighbourhood, addr.quarter]
      .filter(Boolean)
      .join(', ');
    const streetAddress = streetPart || locality || '';
    const displayName =
      [streetPart, locality, city, region].filter(Boolean).join(', ') ||
      data?.display_name ||
      `Location near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const result: ReverseGeocodeResult = {
      displayName,
      city: String(city),
      region: String(region),
      streetAddress: String(streetAddress),
    };
    reverseCache.set(key, result);
    return result;
  } catch (err) {
    console.error('[reverseGeocode] error:', err);
    reverseCache.set(key, null);
    return null;
  }
}