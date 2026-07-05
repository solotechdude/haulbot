/**
 * Relay load board filter SSOT — bot chips and extension apply mirror these lists.
 */
import type { EquipmentMain } from "./campaign.js";

/** Origin search radius options (miles) — Relay dropdown values only. */
export const RELAY_RADIUS_MILES = [25, 50, 100, 150, 200, 250] as const;

export const DEFAULT_RELAY_RADIUS = 50;

export const RELAY_RATE_CHIPS = [2, 2.5, 3] as const;

export const RELAY_PAYOUT_CHIPS = [150, 200, 250] as const;

export const MAX_ORIGINS = 5;

/** Relay origin autocomplete labels — same "City, ST" format as the load board dropdown. */
export interface RelayOriginMarket {
  label: string;
  token: string;
}

export const RELAY_ORIGIN_MARKETS: RelayOriginMarket[] = [
  { label: "Brampton, ON", token: "BRAMPTON" },
  { label: "Mississauga, ON", token: "MISSISSAUGA" },
  { label: "Toronto, ON", token: "TORONTO" },
  { label: "Vaughan, ON", token: "VAUGHAN" },
  { label: "Hamilton, ON", token: "HAMILTON" },
  { label: "London, ON", token: "LONDON" },
  { label: "Kitchener, ON", token: "KITCHENER" },
  { label: "Ottawa, ON", token: "OTTAWA" },
  { label: "Montreal, QC", token: "MONTREAL" },
  { label: "Calgary, AB", token: "CALGARY" },
  { label: "Edmonton, AB", token: "EDMONTON" },
  { label: "Vancouver, BC", token: "VANCOUVER" },
  { label: "Winnipeg, MB", token: "WINNIPEG" },
  { label: "Detroit, MI", token: "DETROIT" },
  { label: "Chicago, IL", token: "CHICAGO" },
  { label: "Atlanta, GA", token: "ATLANTA" },
  { label: "Dallas, TX", token: "DALLAS" },
  { label: "Memphis, TN", token: "MEMPHIS" },
];

export function originMarketLabel(token: string): string {
  const hit = RELAY_ORIGIN_MARKETS.find((m) => m.token === token.toUpperCase());
  return hit?.label ?? token;
}

export function sortOriginMarkets(preferTokens: string[]): RelayOriginMarket[] {
  const prefer = new Set(preferTokens.map((t) => t.toUpperCase()));
  const preferred = RELAY_ORIGIN_MARKETS.filter((m) => prefer.has(m.token));
  const rest = RELAY_ORIGIN_MARKETS.filter((m) => !prefer.has(m.token));
  return [...preferred, ...rest];
}

export interface EquipmentMainOption {
  id: EquipmentMain;
  label: string;
}

export const EQUIPMENT_MAIN_OPTIONS: EquipmentMainOption[] = [
  { id: "power_only", label: "Power only" },
  { id: "box_truck", label: "Box truck" },
  { id: "tractor_trailer", label: "Tractor and trailer" },
];

/** Relay sub labels per main category (See more equipment) — exact Relay row text. */
export const EQUIPMENT_SUB_OPTIONS: Record<EquipmentMain, string[]> = {
  power_only: ["All", "20' Container", "40' Container", "45' Container"],
  box_truck: ["All", "26' Truck", "24' Truck"],
  tractor_trailer: ["All", "53' Trailer", "48' Truck", "26' Truck", "24' Truck"],
};

export const DEFAULT_EQUIPMENT_MAIN: EquipmentMain = "tractor_trailer";

export const DEFAULT_EQUIPMENT_SUBS: Record<EquipmentMain, string[]> = {
  power_only: ["All"],
  box_truck: ["All"],
  tractor_trailer: ["All", "53' Trailer"],
};

/** Relay Work type filter labels (optional — extension apply v2). */
export const RELAY_WORK_TYPES = [
  "One way",
  "Round trip",
  "Block",
  "Power only",
] as const;

/** Relay Load type filter labels (optional — extension apply v2). */
export const RELAY_LOAD_TYPES = [
  "Drop",
  "Live",
  "Drop and hook",
  "Live unload",
] as const;

export function equipmentMainLabel(main: EquipmentMain): string {
  return EQUIPMENT_MAIN_OPTIONS.find((o) => o.id === main)?.label ?? main;
}

export function normalizeRadiusMiles(value: number): number {
  const allowed = RELAY_RADIUS_MILES as readonly number[];
  if (allowed.includes(value)) return value;
  return allowed.reduce((best, n) =>
    Math.abs(n - value) < Math.abs(best - value) ? n : best,
  );
}
