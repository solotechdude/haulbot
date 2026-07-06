import type { ActiveLeg, DispatchHandoff } from "@haulbot/shared";
import { normalizeMarketCity, resolveMarketCity } from "@haulbot/shared";
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
): Promise<DispatchHandoff | null> {
  const existing = await getDispatchState(userId);
  // Two-trip cap: skip handoff when next leg is already hunting or booked.
  if (existing?.queuedCommitment || existing?.activeLeg) {
    const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
    await ensureDispatchDashboardPin(userId);
    return null;
  }

  const now = new Date().toISOString();
  const deliveryCity = resolveMarketCity(input.deliveryCity);
  const hardRules = defaultHardRules(input.priorLeg);
  // Next leg starts where this load delivers; default destination = anywhere (same token).
  const nextOrigin = deliveryCity !== "UNKNOWN" ? deliveryCity : normalizeMarketCity(input.priorLeg?.searchCriteria.origin);

  // I2 — cache Market Intelligence for the delivery lane at handoff
  const laneInsights =
    nextOrigin !== "UNKNOWN" ? await fetchLaneInsights(nextOrigin, nextOrigin) : null;

  const handoff: DispatchHandoff = {
    deliveryCity: nextOrigin,
    bookedLoadId: input.bookedLoadId,
    suggestedReadiness: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    awaitingField: "readiness",
    draftNextLeg: {
      searchCriteria: {
        origin: nextOrigin,
        destination: nextOrigin,
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

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(userId);

  return handoff;
}

export async function dismissHandoff(userId: string): Promise<void> {
  const plan = await getDispatchPlan(userId);
  if (!plan?.handoff) return;

  plan.handoff = null;
  plan.updatedAt = new Date().toISOString();
  await upsertDispatchPlan(plan);

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(userId);
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
  if (state.queuedCommitment) throw new Error("NEXT_LEG_FULL");

  state.activeLeg = activeLeg;
  state.campaignSessionId = crypto.randomUUID();
  state.canceledHunt = null;
  state.paused = false;
  state.updatedAt = now;
  await upsertDispatchState(state);

  plan.handoff = null;
  plan.updatedAt = now;
  await upsertDispatchPlan(plan);

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(userId);

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

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(userId);

  return plan.handoff;
}
