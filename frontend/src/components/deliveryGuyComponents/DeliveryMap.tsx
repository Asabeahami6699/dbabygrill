// components/deliveryGuyComponents/DeliveryMap.tsx
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useRoute } from './hooks/useRoute';
import { geocodeAddress } from '../../lib/geocode';
import { getMapTileLayerConfig } from '../../lib/mapTiles';

// ── Leaflet default icon fix for bundlers ────────────────────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});

// ── Custom icons ──────────────────────────────────────────────────────────
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:42px;height:42px;
    background:#ea580c;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    font-size:20px;
  ">🛵</div>`,
  iconSize:    [42, 42],
  iconAnchor:  [21, 21],
  popupAnchor: [0, -24],
});

const destinationIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:36px;">
    <div style="
      width:36px;height:36px;
      background:#16a34a;
      border:3px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
    "></div>
    <span style="
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-60%);
      font-size:14px;
    ">📍</span>
  </div>`,
  iconSize:    [36, 36],
  iconAnchor:  [18, 36],
  popupAnchor: [0, -38],
});

// ── Props ─────────────────────────────────────────────────────────────────
interface DeliveryMapProps {
  // Driver live coords — passed directly from useLiveLocation (already in memory)
  driverLat:         number | null | undefined;
  driverLng:         number | null | undefined;
  driverSpeed?:      number | null;
  driverName?:       string;
  isOnline?:         boolean;

  // Destination — use coords when available (GPS checkout); else geocode address string
  deliveryAddress?:  string;
  destinationLat?:   number | null;
  destinationLng?:   number | null;
  destinationLabel?: string;

  height?:    string;
  className?: string;
}

export default function DeliveryMap({
  driverLat,
  driverLng,
  driverSpeed,
  driverName       = 'You',
  isOnline         = true,
  deliveryAddress,
  destinationLat,
  destinationLng,
  destinationLabel = 'Delivery address',
  height           = '400px',
  className        = '',
}: DeliveryMapProps) {

  // ── Geocode destination ───────────────────────────────────────────────
  const [destLat,   setDestLat]   = useState<number | null>(null);
  const [destLng,   setDestLng]   = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (destinationLat != null && destinationLng != null) {
      setDestLat(destinationLat);
      setDestLng(destinationLng);
      setGeocoding(false);
      return;
    }
    if (!deliveryAddress) {
      setDestLat(null);
      setDestLng(null);
      return;
    }
    setGeocoding(true);
    setDestLat(null);
    setDestLng(null);
    geocodeAddress(deliveryAddress).then(result => {
      setGeocoding(false);
      if (result) {
        setDestLat(result.lat);
        setDestLng(result.lng);
      }
    });
  }, [deliveryAddress, destinationLat, destinationLng]);

  // ── Route: driver coords → destination coords ─────────────────────────
  const driverLatLng =
    driverLat != null && driverLng != null
      ? { lat: driverLat, lng: driverLng }
      : null;

  const destLatLng =
    destLat != null && destLng != null
      ? { lat: destLat, lng: destLng }
      : null;

  const route = useRoute(driverLatLng, destLatLng);

  // ── Map refs ──────────────────────────────────────────────────────────
  const [mapReady,      setMapReady]      = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef   = useRef<L.Marker | null>(null);
  const routeCasingRef  = useRef<L.Polyline | null>(null);
  const routeLineRef    = useRef<L.Polyline | null>(null);
  const hasAutoFit      = useRef(false);

  // ── Init map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl:        true,
      attributionControl: true,
      preferCanvas:       true,
    }).setView([5.6037, -0.1870], 13); // Accra default

    const tiles = getMapTileLayerConfig();
    L.tileLayer(tiles.url, tiles.options).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current          = null;
      driverMarkerRef.current = null;
      destMarkerRef.current   = null;
      routeCasingRef.current  = null;
      routeLineRef.current    = null;
      hasAutoFit.current      = false;
      setMapReady(false);
    };
  }, []);

  // ── Driver marker — re-runs every time GPS coords update ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || driverLat == null || driverLng == null) return;

    const latlng   = L.latLng(driverLat, driverLng);
    const speedKmh = driverSpeed != null ? (driverSpeed * 3.6).toFixed(1) : '—';

    const popup = `
      <div style="font-family:sans-serif;font-size:13px;min-width:150px;line-height:1.6">
        <b style="font-size:14px">🛵 ${driverName}</b><br/>
        <span style="color:${isOnline ? '#16a34a' : '#9ca3af'}">
          ${isOnline ? '● Online' : '○ Offline'}
        </span><br/>
        Speed: ${speedKmh} km/h
      </div>`;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker(latlng, { icon: driverIcon })
        .addTo(map)
        .bindPopup(popup);

      // First appearance — fit to show both markers if destination is ready
      if (!hasAutoFit.current) {
        if (destMarkerRef.current) {
          const group = L.featureGroup([driverMarkerRef.current, destMarkerRef.current]);
          map.fitBounds(group.getBounds().pad(0.25), { animate: true });
        } else {
          map.setView(latlng, 15, { animate: true });
        }
        hasAutoFit.current = true;
      }
    } else {
      // Smooth position update — marker moves as GPS updates
      driverMarkerRef.current.setLatLng(latlng);
      driverMarkerRef.current.setPopupContent(popup);
    }
  }, [mapReady, driverLat, driverLng, driverSpeed, driverName, isOnline]);

  // ── Destination marker ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (destLat == null || destLng == null) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      return;
    }

    const pos: L.LatLngTuple = [destLat, destLng];
    const popup = `
      <div style="font-family:sans-serif;font-size:13px;line-height:1.5">
        <b>📍 ${destinationLabel}</b>
        ${deliveryAddress
          ? `<br/><span style="color:#6b7280;font-size:11px">${deliveryAddress}</span>`
          : ''}
      </div>`;

    if (!destMarkerRef.current) {
      destMarkerRef.current = L.marker(pos, { icon: destinationIcon })
        .addTo(map)
        .bindPopup(popup);
      // Pan to dest if driver hasn't appeared yet
      if (!driverMarkerRef.current && !hasAutoFit.current) {
        map.setView(pos, 15, { animate: true });
      }
    } else {
      destMarkerRef.current.setLatLng(pos);
      destMarkerRef.current.setPopupContent(popup);
    }
  }, [mapReady, destLat, destLng, destinationLabel, deliveryAddress]);

  // ── Route polyline ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (route.length < 2) {
      [routeCasingRef, routeLineRef].forEach(ref => {
        if (ref.current) { map.removeLayer(ref.current); ref.current = null; }
      });
      return;
    }

    const latLngs = route.map(p => L.latLng(p.lat, p.lng));

    // White casing beneath
    if (!routeCasingRef.current) {
      routeCasingRef.current = L.polyline(latLngs, {
        color: '#ffffff', weight: 9, opacity: 0.7,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
    } else {
      routeCasingRef.current.setLatLngs(latLngs);
    }

    // Orange route on top
    if (!routeLineRef.current) {
      routeLineRef.current = L.polyline(latLngs, {
        color: '#ea580c', weight: 5, opacity: 0.9,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
    } else {
      routeLineRef.current.setLatLngs(latLngs);
    }

    // Always fit both markers when route draws
    if (driverMarkerRef.current && destMarkerRef.current) {
      const group = L.featureGroup([driverMarkerRef.current, destMarkerRef.current]);
      map.fitBounds(group.getBounds().pad(0.25), { animate: true });
      hasAutoFit.current = true;
    }
  }, [mapReady, route]);

  // ── Render ────────────────────────────────────────────────────────────
  const hasDriver = driverLat != null && driverLng != null;

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ height }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Status — top right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 items-end">
        {!hasDriver ? (
          <Badge color="yellow">Waiting for GPS…</Badge>
        ) : isOnline ? (
          <Badge color="green">● Live</Badge>
        ) : (
          <Badge color="gray">Driver offline</Badge>
        )}
        {geocoding && <Badge color="yellow">📍 Resolving address…</Badge>}
        {!geocoding && deliveryAddress && destLat == null && (
          <Badge color="red">📍 Address not found</Badge>
        )}
      </div>

      {/* Offline notice — bottom center */}
      {hasDriver && !isOnline && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000]">
          <Badge color="gray">Driver is currently offline</Badge>
        </div>
      )}

      {/* Directions button — bottom right */}
      {hasDriver && destLat != null && destLng != null && (
        <div className="absolute bottom-3 right-3 z-[1000]">
          <a
            href={
              `https://www.google.com/maps/dir/?api=1` +
              `&origin=${driverLat},${driverLng}` +
              `&destination=${destLat},${destLng}` +
              `&travelmode=driving`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-semibold shadow border border-gray-200 text-orange-600 hover:bg-orange-50 transition-colors"
          >
            🧭 Directions
          </a>
        </div>
      )}

      {/* Re-center — bottom left */}
      {(hasDriver || destLat != null) && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <button
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              if (driverMarkerRef.current && destMarkerRef.current) {
                map.fitBounds(
                  L.featureGroup([driverMarkerRef.current, destMarkerRef.current])
                    .getBounds().pad(0.25),
                  { animate: true }
                );
              } else if (driverMarkerRef.current) {
                map.setView(driverMarkerRef.current.getLatLng(), 15, { animate: true });
              } else if (destMarkerRef.current) {
                map.setView(destMarkerRef.current.getLatLng(), 15, { animate: true });
              }
            }}
            className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-semibold shadow border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⊕ Re-center
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({
  color, children,
}: {
  color: 'green' | 'yellow' | 'red' | 'gray';
  children: React.ReactNode;
}) {
  const colors = {
    green:  'bg-green-100  text-green-800  border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red:    'bg-red-100    text-red-800    border-red-200',
    gray:   'bg-gray-100   text-gray-600   border-gray-200',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-sm whitespace-nowrap ${colors[color]}`}>
      {children}
    </span>
  );
}