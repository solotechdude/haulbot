import type { DispatchState } from "@haulbot/shared";
import { formatRouteLabel } from "@haulbot/shared";
import { getDb, upsertDispatchState } from "./db";
import { sendTelegramMessage } from "./telegram/notify";

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
  if (state.relayAccess) return null; // already alerted via the relay-access flow
  if (state.commitment) return null;

  const opensAt = state.activeLeg.searchOpensAt
    ? new Date(state.activeLeg.searchOpensAt).getTime()
    : 0;
  if (opensAt > now.getTime()) return null; // deferred leg — not due yet

  const heartbeat = state.heartbeatAt ? new Date(state.heartbeatAt).getTime() : 0;
  if (now.getTime() - heartbeat > HEARTBEAT_STALL_MS) return "offline";

  const lastScan = state.agentStatus?.lastScanSummary?.at;
  const anchor = Math.max(
    lastScan ? new Date(lastScan).getTime() : 0,
    state.armedAt ? new Date(state.armedAt).getTime() : 0,
    opensAt,
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
      !state.commitment &&
      !state.relayAccess,
  );
}

function driverMessageForStall(kind: AgentHealthIssue, state: DispatchState): string {
  const route = formatRouteLabel(
    state.activeLeg?.searchCriteria.origin,
    state.activeLeg?.searchCriteria.destination,
  );

  if (kind === "offline") {
    return (
      `Your agent went offline.\n\n` +
      `Campaign ${route} is armed but the extension hasn't checked in for over 3 minutes. ` +
      `No loads are being searched right now. The browser environment may have restarted — ` +
      `dispatch resumes automatically when it reconnects, and you'll get a message here.`
    );
  }

  return (
    `Your agent is NOT searching.\n\n` +
    `Campaign ${route} is armed but no load board scan has completed in over 5 minutes. ` +
    `Most common cause: Amazon Relay is blocking the load board page ` +
    `(missing Load Board permission or a signed-out session).\n\n` +
    `Open relay.amazon.com/loadboard/search and check for a permissions or login message. ` +
    `If you see "You do not have permissions", ask your carrier administrator to grant ` +
    `Load Board access. You'll get a message here when scanning resumes.`
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

      await sendTelegramMessage(state.userId, driverMessageForStall(issue, state));
      console.warn("[watchdog] %s for user %s", issue, state.userId);
    } else if (!issue && state.watchdogAlert) {
      state.watchdogAlert = null;
      state.updatedAt = now.toISOString();
      await upsertDispatchState(state);

      if (shouldAnnounceRecovery(state)) {
        await sendTelegramMessage(
          state.userId,
          "Your agent is back — load board scanning resumed.",
        );
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
