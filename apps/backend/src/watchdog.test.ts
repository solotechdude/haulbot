import { describe, expect, test } from "bun:test";
import type { DispatchState } from "@haulbot/shared";
import { evaluateAgentHealth, shouldAnnounceRecovery } from "./watchdog";

const NOW = new Date("2026-07-02T12:00:00Z");

function minutesAgo(min: number): string {
  return new Date(NOW.getTime() - min * 60 * 1000).toISOString();
}

function armedState(overrides: Partial<DispatchState> = {}): DispatchState {
  return {
    userId: "u1",
    paused: false,
    commitment: null,
    activeLeg: {
      mode: "campaign",
      searchCriteria: { origin: "BRAMPTON", destination: "BRAMPTON" },
      hardRules: { minRate: 3, minPayout: 200 },
      searchOpensAt: minutesAgo(30),
    },
    campaignSessionId: "session-1",
    armedAt: minutesAgo(30),
    heartbeatAt: minutesAgo(0),
    updatedAt: minutesAgo(0),
    ...overrides,
  };
}

describe("evaluateAgentHealth", () => {
  test("healthy: fresh heartbeat and recent scan", () => {
    const state = armedState({
      agentStatus: {
        relayWorkState: "scanning",
        armed: true,
        lastScanSummary: { scanned: 12, booked: false, at: minutesAgo(1) },
        updatedAt: minutesAgo(0),
      },
    });
    expect(evaluateAgentHealth(state, NOW)).toBeNull();
  });

  test("offline: no heartbeat for over 3 minutes", () => {
    expect(evaluateAgentHealth(armedState({ heartbeatAt: minutesAgo(5) }), NOW)).toBe("offline");
  });

  test("scan_stalled: heartbeats fine but never scanned since arming", () => {
    // The Relay permissions-wall case: extension alive, page blocked
    expect(evaluateAgentHealth(armedState(), NOW)).toBe("scan_stalled");
  });

  test("scan_stalled: last scan too old", () => {
    const state = armedState({
      agentStatus: {
        relayWorkState: "ready",
        armed: true,
        lastScanSummary: { scanned: 4, booked: false, at: minutesAgo(10) },
        updatedAt: minutesAgo(0),
      },
    });
    expect(evaluateAgentHealth(state, NOW)).toBe("scan_stalled");
  });

  test("no alert while paused", () => {
    expect(evaluateAgentHealth(armedState({ paused: true }), NOW)).toBeNull();
  });

  test("no alert when leg is deferred to the future", () => {
    const state = armedState();
    state.activeLeg!.searchOpensAt = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    expect(evaluateAgentHealth(state, NOW)).toBeNull();
  });

  test("no alert when relay-access flow already owns the incident", () => {
    const state = armedState({
      relayAccess: { kind: "permission_denied", detectedAt: minutesAgo(2) },
    });
    expect(evaluateAgentHealth(state, NOW)).toBeNull();
  });

  test("no alert with an active commitment (not expected to scan)", () => {
    const state = armedState({
      commitment: { loadId: "T-1", origin: "A", destination: "B", status: "booked" },
    });
    expect(evaluateAgentHealth(state, NOW)).toBeNull();
  });

  test("no alert when not armed", () => {
    expect(evaluateAgentHealth(armedState({ campaignSessionId: null }), NOW)).toBeNull();
  });
});

describe("shouldAnnounceRecovery", () => {
  test("announces when armed and genuinely healthy again", () => {
    expect(shouldAnnounceRecovery(armedState())).toBe(true);
  });

  test("silent when relay-access flow owns the incident (stalled → blocked handover)", () => {
    // The false "agent is back" bug: watchdog alert clears because relayAccess
    // was set, but the permissions wall is still up — no recovery message.
    const state = armedState({
      relayAccess: { kind: "permission_denied", detectedAt: minutesAgo(1) },
    });
    expect(shouldAnnounceRecovery(state)).toBe(false);
  });

  test("silent when the driver paused the agent", () => {
    expect(shouldAnnounceRecovery(armedState({ paused: true }))).toBe(false);
  });

  test("silent when the leg was cleared or disarmed", () => {
    expect(shouldAnnounceRecovery(armedState({ activeLeg: null }))).toBe(false);
    expect(shouldAnnounceRecovery(armedState({ campaignSessionId: null }))).toBe(false);
  });

  test("silent when a commitment landed (scanning no longer expected)", () => {
    const state = armedState({
      commitment: { loadId: "T-1", origin: "A", destination: "B", status: "booked" },
    });
    expect(shouldAnnounceRecovery(state)).toBe(false);
  });
});
