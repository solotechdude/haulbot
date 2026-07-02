import type { ActiveLeg, DispatchHandoff } from "@relaybooking/shared";
import { fetchLaneInsights } from "../analytics/engine-client";
import { getDispatchPlan, getDispatchState, upsertDispatchPlan, upsertDispatchState } from "../db";

export interface OpenHandoffInput {
  bookedLoadId: string;
  deliveryCity: string;
  priorLeg?: ActiveLeg | null;
}

function defaultHardRules(priorLeg?: ActiveLeg | null) {
  return priorLeg?.hardRules ?? { minRate: 2.5, minPayout: 800 };
}

export async function openHandoffOnBook(
  userId: string,
  input: OpenHandoffInput,
): Promise<DispatchHandoff> {
  const now = new Date().toISOString();
  const deliveryCity = input.deliveryCity.toUpperCase();
  const hardRules = defaultHardRules(input.priorLeg);
  const destination = input.priorLeg?.searchCriteria.destination?.toUpperCase() ?? deliveryCity;

  // I2 — cache Market Intelligence for the delivery lane at handoff
  const laneInsights =
    deliveryCity !== "UNKNOWN" ? await fetchLaneInsights(deliveryCity, destination) : null;

  const handoff: DispatchHandoff = {
    deliveryCity,
    bookedLoadId: input.bookedLoadId,
    suggestedReadiness: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    awaitingField: "readiness",
    draftNextLeg: {
      searchCriteria: {
        origin: deliveryCity,
        destination,
      },
      hardRules,
    },
    laneInsights,
  };

  const plan = (await getDispatchPlan(userId)) ?? {
    userId,
    continuityQueue: [],
    handoff: null,
    updatedAt: now,
  };

  plan.handoff = handoff;
  plan.updatedAt = now;
  await upsertDispatchPlan(plan);

  return handoff;
}

export async function dismissHandoff(userId: string): Promise<void> {
  const plan = await getDispatchPlan(userId);
  if (!plan?.handoff) return;

  plan.handoff = null;
  plan.updatedAt = new Date().toISOString();
  await upsertDispatchPlan(plan);
}

export async function completeHandoffReadiness(
  userId: string,
  readinessWindow: string,
): Promise<{ activeLeg: ActiveLeg; readinessWindow: string }> {
  const plan = await getDispatchPlan(userId);
  if (!plan?.handoff) throw new Error("NO_HANDOFF");

  const draft = plan.handoff.draftNextLeg;
  const now = new Date().toISOString();

  const activeLeg: ActiveLeg = {
    mode: "campaign",
    searchCriteria: { ...draft.searchCriteria },
    hardRules: { ...draft.hardRules },
    bookPriority: "payout_then_rate",
    readinessWindow,
    searchOpensAt: readinessWindow,
  };

  const state = await getDispatchState(userId);
  if (!state) throw new Error("NO_STATE");

  state.activeLeg = activeLeg;
  // Defer extension arming while driver still has an active commitment
  state.campaignSessionId = state.commitment ? null : crypto.randomUUID();
  state.paused = false;
  state.updatedAt = now;
  await upsertDispatchState(state);

  plan.handoff = null;
  plan.updatedAt = now;
  await upsertDispatchPlan(plan);

  return { activeLeg, readinessWindow };
}

export async function getPendingHandoff(userId: string): Promise<DispatchHandoff | null> {
  const plan = await getDispatchPlan(userId);
  return plan?.handoff ?? null;
}

export interface HandoffDraftUpdate {
  origin?: string;
  destination?: string;
  minRate?: number;
  minPayout?: number;
}

export async function updateHandoffDraft(
  userId: string,
  input: HandoffDraftUpdate,
): Promise<DispatchHandoff> {
  const plan = await getDispatchPlan(userId);
  if (!plan?.handoff) throw new Error("NO_HANDOFF");

  const draft = plan.handoff.draftNextLeg;
  const origin = (input.origin ?? draft.searchCriteria.origin ?? plan.handoff.deliveryCity).toUpperCase();
  const destination = (input.destination ?? draft.searchCriteria.destination ?? origin).toUpperCase();
  const minRate = input.minRate ?? draft.hardRules.minRate;
  const minPayout = input.minPayout ?? draft.hardRules.minPayout;

  draft.searchCriteria = { ...draft.searchCriteria, origin, destination };
  draft.hardRules = { minRate, minPayout };
  plan.handoff.awaitingField = "readiness";
  plan.updatedAt = new Date().toISOString();
  await upsertDispatchPlan(plan);

  return plan.handoff;
}
