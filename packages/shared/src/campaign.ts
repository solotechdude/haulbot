/**
 * Campaign helpers — board min default rule and book priority.
 * Driver-facing flow: docs/campaign-bot-flow.md
 */
import type { HardRules, SearchCriteria } from "./dispatch";

export type BookPriority = "payout_then_rate";

export type EquipmentMain = "power_only" | "box_truck" | "tractor_trailer";

export interface EquipmentSelection {
  main: EquipmentMain;
  /** Relay sub labels, e.g. "53' Trailer", "All" */
  subs: string[];
}

/** Relay board price mins — omitted when Wide Net is on. */
export function resolveBoardMins(
  searchCriteria: SearchCriteria,
  hardRules: HardRules,
): { boardMinRate?: number; boardMinPayout?: number } {
  if (searchCriteria.wideNet) {
    return {};
  }

  return {
    boardMinRate:
      searchCriteria.boardMinRate ??
      searchCriteria.minRate ??
      hardRules.minRate,
    boardMinPayout:
      searchCriteria.boardMinPayout ??
      searchCriteria.minPayout ??
      hardRules.minPayout,
  };
}

export const DEFAULT_BOOK_PRIORITY: BookPriority = "payout_then_rate";
