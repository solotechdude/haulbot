import { resolveMarketCity } from "@haulbot/shared";

/** Relay market centroids — fallback when reverse geocoding fails. */
const MARKET_COORDS: Record<string, { lat: number; lon: number }> = {
  BRAMPTON: { lat: 43.7315, lon: -79.7624 },
  MISSISSAUGA: { lat: 43.589, lon: -79.6441 },
  TORONTO: { lat: 43.6532, lon: -79.3832 },
  VAUGHAN: { lat: 43.8361, lon: -79.4983 },
  HAMILTON: { lat: 43.2557, lon: -79.8711 },
  LONDON: { lat: 42.9849, lon: -81.2453 },
  KITCHENER: { lat: 43.4516, lon: -80.4925 },
  OTTAWA: { lat: 45.4215, lon: -75.6972 },
  MONTREAL: { lat: 45.5017, lon: -73.5673 },
  CALGARY: { lat: 51.0447, lon: -114.0719 },
  EDMONTON: { lat: 53.5461, lon: -113.4938 },
  VANCOUVER: { lat: 49.2827, lon: -123.1207 },
  WINNIPEG: { lat: 49.8954, lon: -97.1385 },
  DETROIT: { lat: 42.3314, lon: -83.0458 },
  CHICAGO: { lat: 41.8781, lon: -87.6298 },
  ATLANTA: { lat: 33.749, lon: -84.388 },
  DALLAS: { lat: 32.7767, lon: -96.797 },
  MEMPHIS: { lat: 35.1495, lon: -90.049 },
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestMarketCity(lat: number, lon: number): string {
  let best = "UNKNOWN";
  let bestKm = Infinity;
  for (const [token, coords] of Object.entries(MARKET_COORDS)) {
    const km = haversineKm(lat, lon, coords.lat, coords.lon);
    if (km < bestKm) {
      bestKm = km;
      best = token;
    }
  }
  // ~100mi — still useful when Nominatim is unavailable.
  return bestKm <= 160 ? best : "UNKNOWN";
}

/** Map GPS coordinates to a Relay origin market token. */
export async function resolveLocationToMarketCity(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");

    const res = await fetch(url, {
      headers: { "User-Agent": "HaulbotBot/1.0 (telegram; haulbot dispatch)" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string | undefined>;
      };
      const candidates = [
        data.address?.city,
        data.address?.town,
        data.address?.village,
        data.address?.municipality,
        data.address?.county,
        data.display_name,
      ];
      for (const raw of candidates) {
        if (!raw) continue;
        const token = resolveMarketCity(raw);
        if (token !== "UNKNOWN") return token;
      }
    }
  } catch {
    // fall through to nearest market
  }
  return nearestMarketCity(lat, lon);
}
