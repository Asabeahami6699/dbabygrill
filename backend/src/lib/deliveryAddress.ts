export interface DeliveryFormInput {
  address?: string;
  city?: string;
  landmark?: string;
  locationLabel?: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  locationInputMode?: 'manual' | 'gps';
}

export function buildDeliveryAddressInfo(
  formData: DeliveryFormInput,
  isPickup: boolean
): {
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
} {
  if (isPickup) {
    return { deliveryAddress: 'Pickup', deliveryLatitude: null, deliveryLongitude: null };
  }

  const lat = parseCoord(formData.deliveryLatitude);
  const lng = parseCoord(formData.deliveryLongitude);
  const street = (formData.address || '').trim();
  const city = (formData.city || '').trim();
  const landmark = (formData.landmark || '').trim();
  const label = (formData.locationLabel || '').trim();

  if (lat != null && lng != null) {
    const parts: string[] = [];
    if (label) parts.push(label);
    else parts.push(`Live GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    if (landmark) parts.push(`Landmark: ${landmark}`);
    if (city) parts.push(city);
    return {
      deliveryAddress: parts.join(', '),
      deliveryLatitude: lat,
      deliveryLongitude: lng,
    };
  }

  const parts: string[] = [];
  if (street) parts.push(street);
  if (landmark) parts.push(`near ${landmark}`);
  if (city) parts.push(city);

  return {
    deliveryAddress: parts.filter(Boolean).join(', '),
    deliveryLatitude: null,
    deliveryLongitude: null,
  };
}

export function validateDeliveryForm(
  formData: DeliveryFormInput,
  isPickup: boolean
): string | null {
  if (isPickup) return null;

  const lat = parseCoord(formData.deliveryLatitude);
  const lng = parseCoord(formData.deliveryLongitude);
  if (lat != null && lng != null) {
    if (!formData.city?.trim()) {
      return 'City / area is required for delivery pricing (confirm after using GPS).';
    }
    return null;
  }

  if (!formData.address?.trim()) {
    return 'Street address is required, or use your current location for precise delivery.';
  }
  if (!formData.city?.trim()) {
    return 'City / area is required.';
  }
  return null;
}

function parseCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
