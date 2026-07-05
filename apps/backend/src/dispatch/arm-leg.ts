import type { ActiveLeg, Commitment, DispatchState, LastCampaignDefaults } from "@haulbot/shared";
import { DEFAULT_REFRESH_POLICY } from "@haulbot/shared";
import { fetchLaneInsights, postingWindowsToHotWindows } from "../analytics/engine-client";
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
  state.armedAt = now;
  state.watchdogAlert = null;
  state.lastCampaignDefaults = extractLastCampaignDefaults(activeLeg);
  state.updatedAt = now;

  // Market Intelligence → refresh hot windows for this lane (best effort)
  if (activeLeg.searchCriteria.origin) {
    const insights = await fetchLaneInsights(
      activeLeg.searchCriteria.origin,
      activeLeg.searchCriteria.destination,
    );
    const hotWindows = postingWindowsToHotWindows(insights);
    if (hotWindows.length > 0) {
      state.refreshPolicy = { ...DEFAULT_REFRESH_POLICY, hotWindows, updatedAt: now };
    }
  }

  await upsertDispatchState(state);
  await dismissHandoff(userId);

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(userId);

  return { ok: true, state };
}

function extractLastCampaignDefaults(activeLeg: ActiveLeg): LastCampaignDefaults {
  const sc = activeLeg.searchCriteria;
  const hr = activeLeg.hardRules;
  return {
    radius: sc.radius,
    destinationRadius: sc.destinationRadius,
    equipment: sc.equipment ? { ...sc.equipment, subs: [...sc.equipment.subs] } : undefined,
    minRate: hr.minRate,
    minPayout: hr.minPayout,
    workTypes: sc.workTypes ? [...sc.workTypes] : undefined,
    loadTypes: sc.loadTypes ? [...sc.loadTypes] : undefined,
  };
}
