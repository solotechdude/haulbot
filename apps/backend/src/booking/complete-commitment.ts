import { getDispatchState, upsertDispatchState } from "../db";

export async function completeCommitment(
  userId: string,
  loadId?: string,
): Promise<{ ok: true; clearedLoadId: string } | { error: string }> {
  const state = await getDispatchState(userId);
  if (!state?.commitment) return { error: "NO_COMMITMENT" };

  if (loadId && state.commitment.loadId !== loadId) {
    return { error: "LOAD_ID_MISMATCH" };
  }

  const clearedLoadId = state.commitment.loadId;
  const now = new Date().toISOString();
  state.commitment = null;
  if (state.activeLeg && !state.campaignSessionId) {
    state.campaignSessionId = crypto.randomUUID();
  }
  state.updatedAt = now;
  await upsertDispatchState(state);

  return { ok: true, clearedLoadId };
}
