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
}

export interface DispatchPlan {
  userId: string;
  continuityQueue: HandoffDraftNextLeg[];
  handoff: DispatchHandoff | null;
  updatedAt: string;
}
