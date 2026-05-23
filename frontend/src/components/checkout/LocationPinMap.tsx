import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapTileLayerConfig } from '../../lib/mapTiles';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface LocationPinMapProps {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

export default function LocationPinMap({
  latitude,
  longitude,
  accuracyM,
  onLocationChange,
  height = '220px',
}: LocationPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onLocationChange);
  onChangeRef.current = onLocationChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([latitude, longitude], 17);

    const tiles = getMapTileLayerConfig();
    L.tileLayer(tiles.url, tiles.options).addTo(map);

    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current(pos.lat, pos.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    const latlng: L.LatLngExpression = [latitude, longitude];
    markerRef.current.setLatLng(latlng);
    mapRef.current.setView(latlng, mapRef.current.getZoom(), { animate: true });

    if (circleRef.current) {
      mapRef.current.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    if (accuracyM != null && accuracyM > 0 && accuracyM < 500) {
      circleRef.current = L.circle(latlng, {
        radius: accuracyM,
        color: '#ea580c',
        fillColor: '#fb923c',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(mapRef.current);
    }
  }, [latitude, longitude, accuracyM]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <div ref={containerRef} style={{ height, width: '100%' }} />
      <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 border-t border-gray-100">
        Drag the pin if the blue dot is not exactly on your building or gate.
      </p>
    </div>
  );
}
