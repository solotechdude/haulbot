import type { ActiveLeg, Commitment, GoalContext } from "@haulbot/shared";
import { armActiveLeg } from "../dispatch/arm-leg";
import { getDb, getDispatchPlan, getDispatchState, upsertDispatchPlan } from "../db";
import { hardRulesFromGoal, interpretGoal } from "./interpret";

export type ApplyGoalResult =
  | { ok: true; activeLeg: ActiveLeg; goal: GoalContext }
  | { ok: false; error: "NEED_ORIGIN"; goal: GoalContext }
  | { ok: false; error: "COMMITMENT_ACTIVE"; commitment: Commitment; goal: GoalContext };

/** O3 — NL Goal → Strategy → activeLeg. */
export async function applyGoal(
  userId: string,
  text: string,
  originOverride?: string,
): Promise<ApplyGoalResult> {
  const goal = interpretGoal(text);
  const now = new Date().toISOString();

  const state = await getDispatchState(userId);
  const origin =
    originOverride?.toUpperCase() ??
    goal.originCity ??
    // Delivering somewhere? The next leg starts there.
    state?.commitment?.destination?.toUpperCase();

  if (!origin || origin === "UNKNOWN") {
    return { ok: false, error: "NEED_ORIGIN", goal };
  }

  const activeLeg: ActiveLeg = {
    mode: "goal",
    searchCriteria: {
      origin,
      destination: goal.destinationCity ?? origin,
    },
    hardRules: hardRulesFromGoal(goal),
    bookPriority: "payout_then_rate",
    readinessWindow: now,
    searchOpensAt: now,
  };

  const armed = await armActiveLeg(userId, activeLeg);
  if (!armed.ok) {
    return { ok: false, error: armed.error, commitment: armed.commitment, goal };
  }

  const plan = (await getDispatchPlan(userId)) ?? {
    userId,
    continuityQueue: [],
    handoff: null,
    updatedAt: now,
  };
  plan.goalContext = { ...goal, originCity: origin };
  plan.updatedAt = now;
  await upsertDispatchPlan(plan);

  const db = await getDb();
  await db.collection("goal_history").insertOne({
    userId,
    text,
    interpreted: plan.goalContext,
    createdAt: now,
  });

  return { ok: true, activeLeg, goal: plan.goalContext };
}
