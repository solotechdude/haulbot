import type { HardRules, SearchCriteria } from "./dispatch";

export type HandoffAwaitingField = "readiness" | "criteria" | null;

export interface HandoffDraftNextLeg {
  searchCriteria: SearchCriteria;
  hardRules: HardRules;
}

export interface DispatchHandoff {
  deliveryCity: string;
  bookedLoadId: string;
  suggestedReadiness: string;
  awaitingField: HandoffAwaitingField;
  draftNextLeg: HandoffDraftNextLeg;
  /** Market Intelligence for the delivery lane, cached at handoff (I2/I3) */
  laneInsights?: import("./telemetry.js").LaneInsights | null;
}

/** Interpreted Goal (O3) — system-owned Strategy context, opaque to the Driver */
export interface GoalContext {
  /** Raw NL input, e.g. "$8k this week, Atlanta by Thursday" */
  text: string;
  revenueTarget?: number;
  deadline?: string;
  originCity?: string;
  destinationCity?: string;
  /** Derived revenue-per-day used to compute Hard Rules */
  dailyTarget?: number;
  setAt: string;
}

export interface DispatchPlan {
  userId: string;
  continuityQueue: HandoffDraftNextLeg[];
  handoff: DispatchHandoff | null;
  goalContext?: GoalContext | null;
  updatedAt: string;
}
