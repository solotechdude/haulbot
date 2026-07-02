import type { ActiveLeg, Commitment, DispatchState } from "@relaybooking/shared";
import { getDispatchState, upsertDispatchState } from "../db";
import { dismissHandoff } from "../booking/handoff";

export type ArmLegResult =
  | { ok: true; state: DispatchState }
  | { ok: false; error: "COMMITMENT_ACTIVE"; commitment: Commitment };

/**
 * Single write path for arming a leg (campaign or goal mode): sets the
 * activeLeg, rotates the campaign session so only the current arm can book,
 * and clears any stale handoff.
 */
export async function armActiveLeg(
  userId: string,
  activeLeg: ActiveLeg,
  options: { clearCommitment?: boolean } = {},
): Promise<ArmLegResult> {
  const now = new Date().toISOString();
  const existing = await getDispatchState(userId);

  if (existing?.commitment && !options.clearCommitment) {
    return { ok: false, error: "COMMITMENT_ACTIVE", commitment: existing.commitment };
  }

  const state: DispatchState = existing ?? {
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  if (options.clearCommitment) state.commitment = null;
  state.activeLeg = activeLeg;
  state.campaignSessionId = crypto.randomUUID();
  state.paused = false;
  state.updatedAt = now;

  await upsertDispatchState(state);
  await dismissHandoff(userId);

  return { ok: true, state };
}
