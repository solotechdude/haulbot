import { getDispatchState, upsertDispatchState } from "../db";
import { clearDashboardUiPrompts, ensureDispatchDashboardPin } from "../telegram/dashboard-sync";

export async function completeCommitment(
  userId: string,
  loadId?: string,
): Promise<
  | { ok: true; clearedLoadId: string; promotedQueued: boolean; offerRehunt: boolean }
  | { error: string }
> {
  const state = await getDispatchState(userId);
  if (!state?.commitment) return { error: "NO_COMMITMENT" };

  if (loadId && state.commitment.loadId !== loadId) {
    return { error: "LOAD_ID_MISMATCH" };
  }

  const clearedLoadId = state.commitment.loadId;
  const now = new Date().toISOString();
  const hadCanceledHunt = Boolean(state.canceledHunt);

  state.commitment = null;
  state.uiConfirmComplete = false;

  let promotedQueued = false;
  if (state.queuedCommitment) {
    state.commitment = state.queuedCommitment;
    state.queuedCommitment = null;
    state.activeLeg = null;
    state.campaignSessionId = null;
    state.canceledHunt = null;
    promotedQueued = true;
  } else if (state.activeLeg) {
    state.campaignSessionId = crypto.randomUUID();
  }

  const offerRehunt = hadCanceledHunt && !promotedQueued && Boolean(state.canceledHunt);
  if (offerRehunt) {
    state.uiRehuntOffer = true;
  }

  state.updatedAt = now;
  await upsertDispatchState(state);
  await ensureDispatchDashboardPin(userId);

  return { ok: true, clearedLoadId, promotedQueued, offerRehunt };
}

export async function dismissRehuntOffer(userId: string): Promise<void> {
  await clearDashboardUiPrompts(userId);
}
