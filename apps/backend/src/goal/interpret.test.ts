import { describe, expect, test } from "bun:test";
import { hardRulesFromGoal, interpretGoal } from "./interpret";

// Wednesday Jul 1 2026 12:00 UTC
const NOW = new Date("2026-07-01T12:00:00Z");

describe("interpretGoal", () => {
  test("revenue + week deadline", () => {
    const goal = interpretGoal("$8k this week", NOW);
    expect(goal.revenueTarget).toBe(8000);
    expect(goal.deadline).toBeDefined();
    expect(goal.dailyTarget).toBeGreaterThan(0);
  });

  test("thousands with comma", () => {
    const goal = interpretGoal("make $5,500 this week", NOW);
    expect(goal.revenueTarget).toBe(5500);
  });

  test("destination by day", () => {
    const goal = interpretGoal("$8k this week, Atlanta by Thursday", NOW);
    expect(goal.destinationCity).toBe("ATLANTA");
    expect(goal.deadline).toBeDefined();
  });

  test("home by day sets deadline without destination", () => {
    const goal = interpretGoal("home by friday", NOW);
    expect(goal.destinationCity).toBeUndefined();
    expect(new Date(goal.deadline!).getUTCDay()).toBe(5);
  });

  test("origin from 'from CITY'", () => {
    const goal = interpretGoal("$6k from DFW, Miami by Saturday", NOW);
    expect(goal.originCity).toBe("DFW");
    expect(goal.destinationCity).toBe("MIAMI");
  });

  test("no money → no targets", () => {
    const goal = interpretGoal("keep me busy", NOW);
    expect(goal.revenueTarget).toBeUndefined();
    expect(goal.dailyTarget).toBeUndefined();
  });
});

describe("hardRulesFromGoal", () => {
  test("defaults without daily target", () => {
    const rules = hardRulesFromGoal(interpretGoal("keep me busy", NOW));
    expect(rules.minRate).toBe(2.5);
    expect(rules.minPayout).toBe(800);
  });

  test("derived payout floor scales with daily target", () => {
    const goal = interpretGoal("$8k this week", NOW);
    const rules = hardRulesFromGoal(goal);
    expect(rules.minPayout!).toBeGreaterThanOrEqual(300);
    expect(rules.minPayout! % 50).toBe(0);
  });
});
