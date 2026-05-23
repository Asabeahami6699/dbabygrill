import type { TileLayerOptions } from 'leaflet';

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY as string | undefined;

const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' +
  '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Road-focused tiles — clearer street labels for delivery navigation. */
export function getMapTileLayerConfig(): { url: string; options: TileLayerOptions } {
  if (STADIA_KEY?.trim()) {
    return {
      url: `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(STADIA_KEY.trim())}`,
      options: {
        maxZoom: 20,
        attribution: STADIA_ATTRIBUTION,
      },
    };
  }

  // Free fallback — standard OSM tiles (clearest road network, no API key)
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  };
}
