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

/** Tighter framing + higher zoom so roads are easier to read while driving. */
const DRIVER_FOLLOW_ZOOM = 17;
const DRIVER_ONLY_ZOOM = 17;
const FIT_PADDING = 0.06;
const FIT_MAX_ZOOM = 17;

function fitDriverAndDestination(map: L.Map, driver: L.Marker, dest: L.Marker) {
  const bounds = L.featureGroup([driver, dest]).getBounds().pad(FIT_PADDING);
  map.fitBounds(bounds, { animate: true, maxZoom: FIT_MAX_ZOOM, padding: [40, 40] });
}

function focusOnDriver(map: L.Map, latlng: L.LatLng, animate = true) {
  const targetZoom = Math.max(map.getZoom(), DRIVER_FOLLOW_ZOOM);
  map.setView(latlng, targetZoom, { animate });
}

function googleMapsDirectionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
) {
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${originLat},${originLng}` +
    `&destination=${destLat},${destLng}` +
    `&travelmode=driving`
  );
}

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
  const userPannedRef   = useRef(false);

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

    map.on('dragstart', () => {
      userPannedRef.current = true;
    });

    return () => {
      map.off('dragstart');
      map.remove();
      mapRef.current          = null;
      driverMarkerRef.current = null;
      destMarkerRef.current   = null;
      routeCasingRef.current  = null;
      routeLineRef.current    = null;
      hasAutoFit.current      = false;
      userPannedRef.current    = false;
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

      // First appearance — tight fit or driver-centered zoom
      if (!hasAutoFit.current) {
        if (destMarkerRef.current) {
          fitDriverAndDestination(map, driverMarkerRef.current, destMarkerRef.current);
        } else {
          map.setView(latlng, DRIVER_ONLY_ZOOM, { animate: true });
        }
        hasAutoFit.current = true;
      } else if (!userPannedRef.current) {
        focusOnDriver(map, latlng);
      }
    } else {
      // Smooth position update — follow driver unless they panned away
      driverMarkerRef.current.setLatLng(latlng);
      driverMarkerRef.current.setPopupContent(popup);
      if (!userPannedRef.current) {
        focusOnDriver(map, latlng);
      }
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
        map.setView(pos, DRIVER_ONLY_ZOOM, { animate: true });
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
        color: '#ffffff', weight: 11, opacity: 0.85,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
    } else {
      routeCasingRef.current.setLatLngs(latLngs);
    }

    // Orange route on top — thicker for visibility on bright OSM tiles
    if (!routeLineRef.current) {
      routeLineRef.current = L.polyline(latLngs, {
        color: '#ea580c', weight: 7, opacity: 0.95,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
    } else {
      routeLineRef.current.setLatLngs(latLngs);
    }

    // Fit once when route first appears (don't re-zoom on every GPS tick)
    if (
      !hasAutoFit.current &&
      driverMarkerRef.current &&
      destMarkerRef.current
    ) {
      fitDriverAndDestination(map, driverMarkerRef.current, destMarkerRef.current);
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
          <Badge color="gray">Driver is currently offline</Badge>
        </div>
      )}

      {/* Navigate in Google Maps — primary CTA for drivers */}
      {hasDriver && destLat != null && destLng != null && (
        <div className="absolute bottom-0 inset-x-0 z-[1000] p-3 pt-8 bg-gradient-to-t from-black/50 to-transparent pointer-events-none">
          <a
            href={googleMapsDirectionsUrl(driverLat!, driverLng!, destLat, destLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-xl text-sm font-bold shadow-lg border-2 border-white/20 bg-[#4285F4] text-white hover:bg-[#3367D6] active:scale-[0.98] transition-all"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
            Navigate in Google Maps
            <span className="text-xs font-normal opacity-90 hidden sm:inline">
              — clearest roads &amp; turn-by-turn
            </span>
          </a>
        </div>
      )}

      {/* Follow driver — above Google Maps bar */}
      {(hasDriver || destLat != null) && (
        <div className="absolute bottom-[4.5rem] left-3 z-[1000]">
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              userPannedRef.current = false;
              if (driverMarkerRef.current && destMarkerRef.current) {
                fitDriverAndDestination(map, driverMarkerRef.current, destMarkerRef.current);
              } else if (driverMarkerRef.current) {
                focusOnDriver(map, driverMarkerRef.current.getLatLng());
              } else if (destMarkerRef.current) {
                map.setView(destMarkerRef.current.getLatLng(), DRIVER_ONLY_ZOOM, { animate: true });
              }
            }}
            className="inline-flex items-center gap-1.5 bg-white px-3 py-2 rounded-full text-xs font-semibold shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⊕ Follow driver
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