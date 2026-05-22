import type { TileLayerOptions } from 'leaflet';

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY as string | undefined;

/** Stadia works on localhost without a key; production needs api_key or domain auth. */
export function getMapTileLayerConfig(): { url: string; options: TileLayerOptions } {
  if (STADIA_KEY?.trim()) {
    return {
      url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(STADIA_KEY.trim())}`,
      options: {
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' +
          '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    };
  }

  // Free fallback — no API key (works on Vercel/production)
  return {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  };
}
