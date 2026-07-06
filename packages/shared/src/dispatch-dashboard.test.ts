import { describe, expect, test } from "bun:test";
import {
  buildDashboardInlineKeyboard,
  buildHandoffInlineKeyboard,
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
    expect(buildHuntInlineKeyboard("searching").length).toBe(4);
    expect(buildHuntInlineKeyboard("queued")).toEqual([]);
  });

  test("queued pin shows two-trip cap copy", () => {
    const text = formatDispatchDashboardMessage({
      commitment: {
        loadId: "A",
        origin: "BRAMPTON",
        destination: "MISSISSAUGA",
        status: "booked",
      },
      queuedCommitment: {
        loadId: "B",
        origin: "MISSISSAUGA",
        destination: "TORONTO",
        status: "booked",
      },
    });
    expect(text).toContain("2 trips active");
  });
});

describe("buildDashboardInlineKeyboard", () => {
  test("prepends complete trip when on a trip", () => {
    const kb = buildDashboardInlineKeyboard({
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
      },
      armed: true,
    });
    expect(kb[0]![0]!.callback_data).toBe("complete:prompt");
    expect(kb[1]![0]!.callback_data).toBe("dispatch:pause");
  });

  test("handoff primary is one-tap +3h", () => {
    expect(buildHandoffInlineKeyboard()[0]![0]!.callback_data).toBe("handoff:+3h");
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
