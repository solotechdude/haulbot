import type { ActiveLeg, DispatchState } from "@haulbot/shared";
import { getDispatchState, upsertDispatchState } from "../db";
import { syncDispatchDashboard } from "../telegram/dashboard-sync";

export function isActivelyHunting(state: DispatchState): boolean {
  return Boolean(
    state.activeLeg && state.campaignSessionId && !state.queuedCommitment && !state.paused,
  );
}

export async function shiftHuntPickup(
  userId: string,
  readinessWindow: string,
): Promise<{ activeLeg: ActiveLeg; readinessWindow: string }> {
  const state = await getDispatchState(userId);
  if (!state?.activeLeg || state.queuedCommitment) throw new Error("NOT_HUNTING");

  const now = new Date().toISOString();
  state.activeLeg = {
    ...state.activeLeg,
    readinessWindow,
    searchOpensAt: readinessWindow,
  };
  state.updatedAt = now;
  await upsertDispatchState(state);
  await syncDispatchDashboard(userId, state);

  return { activeLeg: state.activeLeg, readinessWindow };
}

export async function shiftHuntPickupByHours(
  userId: string,
  hours: number,
): Promise<{ activeLeg: ActiveLeg; readinessWindow: string }> {
  const state = await getDispatchState(userId);
  if (!state?.activeLeg || state.queuedCommitment) throw new Error("NOT_HUNTING");

  const current =
    state.activeLeg.readinessWindow ??
    state.activeLeg.searchOpensAt ??
    new Date().toISOString();
  const next = new Date(new Date(current).getTime() + hours * 60 * 60 * 1000).toISOString();
  return shiftHuntPickup(userId, next);
}

export async function cancelHunt(userId: string): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state?.activeLeg || state.queuedCommitment) throw new Error("NOT_HUNTING");

  const now = new Date().toISOString();
  state.canceledHunt = { ...state.activeLeg };
  state.activeLeg = null;
  state.campaignSessionId = null;
  state.updatedAt = now;
  await upsertDispatchState(state);
  await syncDispatchDashboard(userId, state);
}
