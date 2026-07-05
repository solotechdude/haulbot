import { describe, expect, test } from "bun:test";
import {
  buildHuntInlineKeyboard,
  formatDispatchDashboardMessage,
  isHuntingForQueued,
  resolveHuntPhase,
} from "./dispatch-dashboard";

describe("formatDispatchDashboardMessage", () => {
  test("shows current trip and searching next leg", () => {
    const text = formatDispatchDashboardMessage({
      commitment: {
        loadId: "ABC",
        origin: "BRAMPTON",
        destination: "MISSISSAUGA",
        status: "booked",
      },
      activeLeg: {
        mode: "campaign",
        searchCriteria: { origin: "MISSISSAUGA", destination: "MISSISSAUGA" },
        hardRules: { minRate: 3, minPayout: 200 },
        readinessWindow: "2026-07-04T16:50:00.000Z",
      },
      armed: true,
      agentStatus: {
        relayWorkState: "scanning",
        armed: true,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(text).toContain("Current trip");
    expect(text).toContain("Next leg · Searching");
    expect(text).toContain("ABC");
  });

  test("hunt buttons only while searching", () => {
    expect(buildHuntInlineKeyboard("searching").length).toBeGreaterThan(0);
    expect(buildHuntInlineKeyboard("queued")).toEqual([]);
  });
});

describe("isHuntingForQueued", () => {
  test("true when commitment + active leg + session and no queue", () => {
    expect(
      isHuntingForQueued({
        commitment: { loadId: "A", origin: "X", destination: "Y", status: "booked" },
        activeLeg: {
          mode: "campaign",
          searchCriteria: { origin: "Y" },
          hardRules: {},
        },
        campaignSessionId: "sid",
        queuedCommitment: null,
      }),
    ).toBe(true);
  });

  test("false when queued filled", () => {
    expect(
      isHuntingForQueued({
        commitment: { loadId: "A", origin: "X", destination: "Y", status: "booked" },
        activeLeg: {
          mode: "campaign",
          searchCriteria: { origin: "Y" },
          hardRules: {},
        },
        campaignSessionId: "sid",
        queuedCommitment: { loadId: "B", origin: "Y", destination: "Y", status: "booked" },
      }),
    ).toBe(false);
  });
});

describe("resolveHuntPhase", () => {
  test("queued when queuedCommitment set", () => {
    expect(
      resolveHuntPhase({
        queuedCommitment: { loadId: "B", origin: "Y", destination: "Y", status: "booked" },
      }),
    ).toBe("queued");
  });
});
