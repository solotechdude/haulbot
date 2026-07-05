/** Normalize Relay location text to campaign market token (e.g. "Brampton, ON" → "BRAMPTON"). */
export function normalizeMarketCity(raw?: string | null): string {
  if (!raw?.trim()) return "UNKNOWN";
  const beforeComma = raw.trim().split(",")[0]?.trim() ?? raw.trim();
  return beforeComma.toUpperCase();
}

const CITY_PROVINCE_RE =
  /\b([A-Za-z][A-Za-z\s.'-]+),\s*(?:ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|NU|[A-Z]{2})\b/;

/** Parse "City, ST" from a single cell or label. */
export function parseCityFromLocationText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const m = trimmed.match(CITY_PROVINCE_RE);
  if (m) return normalizeMarketCity(m[1]);
  if (/^[A-Z]{2,}(?:\s+[A-Z]{2,})?$/.test(trimmed)) return trimmed.toUpperCase();
  return undefined;
}

/** Facility-prefixed Relay text → market city (e.g. "SRU-MATCH-D MISSISSAUGA" → "MISSISSAUGA"). */
export function resolveMarketCity(raw?: string | null): string {
  if (!raw?.trim()) return "UNKNOWN";
  const parsed = parseCityFromLocationText(raw);
  if (parsed) return parsed;
  const norm = normalizeMarketCity(raw);
  const parts = norm.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]+(-[A-Z0-9]+)*$/i.test(parts[0]!)) {
    const city = parts[parts.length - 1]!;
    if (/^[A-Z]{2,}$/i.test(city)) return city.toUpperCase();
  }
  return norm;
}

export interface CampaignRoute {
  origin?: string;
  destination?: string;
}

export interface ParsedRoute {
  origin?: string;
  destination?: string;
}

export function isAnywhereDestination(raw?: string | null): boolean {
  if (!raw?.trim()) return true;
  return /anywhere/i.test(raw.trim());
}

/** Fail closed on explicit destination; origin is enforced by Relay radius filter. */
export function matchesCampaignRoute(
  load: ParsedRoute,
  criteria: CampaignRoute,
): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (criteria.destination?.trim() && !isAnywhereDestination(criteria.destination)) {
    const want = normalizeMarketCity(criteria.destination);
    if (!load.destination) reasons.push("destination_unknown");
    else if (normalizeMarketCity(load.destination) !== want) {
      reasons.push(`route_destination_mismatch_${load.destination}`);
    }
  }

  return { match: reasons.length === 0, reasons };
}
