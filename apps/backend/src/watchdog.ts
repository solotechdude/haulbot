import type { DispatchState } from "@haulbot/shared";
import { isHuntingForQueued } from "@haulbot/shared";
import { getDb, upsertDispatchState } from "./db";

/**
 * Agent-health watchdog — the backend must not trust silence. An armed leg
 * with no completed scans means the driver is waiting for a load that will
 * never be booked (e.g. Relay permissions wall the extension failed to
 * report, dead tab, crashed environment). Verify outcomes; alert on stall.
 */

const CHECK_INTERVAL_MS = 60 * 1000;
/** No heartbeat for this long while armed → extension is offline */
const HEARTBEAT_STALL_MS = 3 * 60 * 1000;
/** Heartbeats fine but no scan completed for this long → agent is stuck */
const SCAN_STALL_MS = 5 * 60 * 1000;

export type AgentHealthIssue = "offline" | "scan_stalled";

/** Pure check so the stall conditions are unit-testable. */
export function evaluateAgentHealth(state: DispatchState, now: Date): AgentHealthIssue | null {
  // Only armed, unblocked legs are expected to be scanning
  if (state.paused || !state.activeLeg || !state.campaignSessionId) return null;
  if (state.relayAccess) return null;
  if (state.queuedCommitment) return null;
  // Hunting while on a trip is expected — only skip when commitment exists without active hunt
  if (state.commitment && !isHuntingForQueued(state)) return null;

  const heartbeat = state.heartbeatAt ? new Date(state.heartbeatAt).getTime() : 0;
  if (now.getTime() - heartbeat > HEARTBEAT_STALL_MS) return "offline";

  const lastScan = state.agentStatus?.lastScanSummary?.at;
  const anchor = Math.max(
    lastScan ? new Date(lastScan).getTime() : 0,
    state.armedAt ? new Date(state.armedAt).getTime() : 0,
  );
  if (anchor > 0 && now.getTime() - anchor > SCAN_STALL_MS) return "scan_stalled";

  return null;
}

/**
 * "Your agent is back" must only go out when scanning genuinely resumed.
 * evaluateAgentHealth also returns null on handover (relay-access flow owns
 * the incident) or when scanning is no longer expected (paused, commitment,
 * leg cleared) — announcing recovery there would lie to the driver while a
 * permissions wall is still up. The relay-access flow sends its own
 * "Relay access restored" message when that incident actually clears.
 */
export function shouldAnnounceRecovery(state: DispatchState): boolean {
  return Boolean(
    !state.paused &&
      state.activeLeg &&
      state.campaignSessionId &&
      !state.queuedCommitment &&
      !state.relayAccess &&
      (!state.commitment || isHuntingForQueued(state)),
  );
}

async function checkAllAgents(now: Date): Promise<void> {
  const db = await getDb();
  const armed = (await db
    .collection("dispatch_states")
    .find({ paused: false, campaignSessionId: { $type: "string" } })
    .toArray()) as unknown as (DispatchState & { _id: unknown })[];

  for (const doc of armed) {
    const { _id, ...state } = doc;
    const issue = evaluateAgentHealth(state, now);

    if (issue && state.watchdogAlert?.kind !== issue) {
      state.watchdogAlert = { kind: issue, at: now.toISOString() };
      state.updatedAt = now.toISOString();
      await upsertDispatchState(state);

      await db.collection("environment_events").insertOne({
        userId: state.userId,
        environmentId: null,
        type: `agent_${issue}`,
        message: `Watchdog: agent ${issue} while campaign armed`,
        createdAt: now.toISOString(),
      });

      const { ensureDispatchDashboardPin } = await import("./telegram/dashboard-sync");
      await ensureDispatchDashboardPin(state.userId);
      console.warn("[watchdog] %s for user %s", issue, state.userId);
    } else if (!issue && state.watchdogAlert) {
      state.watchdogAlert = null;
      state.updatedAt = now.toISOString();
      await upsertDispatchState(state);

      if (shouldAnnounceRecovery(state)) {
        const { ensureDispatchDashboardPin } = await import("./telegram/dashboard-sync");
        await ensureDispatchDashboardPin(state.userId);
        console.log("[watchdog] recovered for user %s", state.userId);
      } else {
        console.log(
          "[watchdog] alert cleared without recovery message for user %s (handover or leg gone)",
          state.userId,
        );
      }
    }
  }
}

export function startAgentWatchdog(): void {
  setInterval(() => {
    void checkAllAgents(new Date()).catch((err) =>
      console.warn("[watchdog] check failed:", (err as Error).message),
    );
  }, CHECK_INTERVAL_MS);

  console.log("[watchdog] agent-health loop started (heartbeat %ds, scan %ds)",
    HEARTBEAT_STALL_MS / 1000, SCAN_STALL_MS / 1000);
}
