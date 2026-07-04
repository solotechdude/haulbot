import type { GoalContext, HardRules } from "@haulbot/shared";

/**
 * Goal mode (O3) — deterministic NL interpretation. Extracts revenue target,
 * deadline, and destination from Driver text like "$8k this week, Atlanta by
 * Thursday", then derives Hard Rules from the implied daily target. The
 * Strategy stays opaque to the Driver per CONTEXT.md.
 */

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function parseRevenueTarget(text: string): number | undefined {
  const match = text.match(/\$\s*(\d+(?:[.,]\d{3})*(?:\.\d+)?)\s*(k)?/i);
  if (!match) return undefined;

  const raw = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return match[2] ? raw * 1000 : raw;
}

function nextDayOccurrence(dayName: string, from: Date): Date {
  const target = DAY_NAMES.indexOf(dayName.toLowerCase() as (typeof DAY_NAMES)[number]);
  const d = new Date(from);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  d.setHours(20, 0, 0, 0);
  return d;
}

function parseDeadline(text: string, now: Date): { deadline?: string; destinationCity?: string } {
  const byDay = text.match(
    /(?:\b(?:in|to|at)\s+)?([A-Za-z][A-Za-z .]{1,30}?)?\s*\bby\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (byDay) {
    const cityToken = byDay[1]?.trim();
    const isCity =
      cityToken &&
      !/^(home|back|there|done|paid|load|loads)$/i.test(cityToken) &&
      !/\$|\d/.test(cityToken);
    return {
      deadline: nextDayOccurrence(byDay[2]!, now).toISOString(),
      destinationCity: isCity ? cityToken.toUpperCase() : undefined,
    };
  }

  if (/\b(this|per)\s+week\b|\bweekly\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return { deadline: d.toISOString() };
  }

  if (/\btoday\b/i.test(text)) {
    const d = new Date(now);
    d.setHours(23, 59, 0, 0);
    return { deadline: d.toISOString() };
  }

  return {};
}

function parseOrigin(text: string): string | undefined {
  const from = text.match(/\bfrom\s+([A-Za-z][A-Za-z .]{1,30}?)(?=[,.]|\s+(?:by|to|in)\b|$)/i);
  return from?.[1]?.trim().toUpperCase();
}

export function interpretGoal(text: string, now: Date = new Date()): GoalContext {
  const revenueTarget = parseRevenueTarget(text);
  const { deadline, destinationCity } = parseDeadline(text, now);
  const originCity = parseOrigin(text);

  let dailyTarget: number | undefined;
  if (revenueTarget) {
    const days = deadline
      ? Math.max(1, Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86_400_000))
      : 7;
    dailyTarget = Math.round(revenueTarget / days);
  }

  return {
    text,
    revenueTarget,
    deadline,
    originCity,
    destinationCity,
    dailyTarget,
    setAt: now.toISOString(),
  };
}

const DEFAULT_HARD_RULES: HardRules = { minRate: 2.5, minPayout: 800 };

/**
 * Hard Rules from the daily target — assume ~2 booked loads per day, floor
 * the payout gate at 45% of daily so one weak load can't sink the day.
 */
export function hardRulesFromGoal(goal: GoalContext): HardRules {
  if (!goal.dailyTarget) return DEFAULT_HARD_RULES;

  const minPayout = Math.max(300, Math.round((goal.dailyTarget * 0.45) / 50) * 50);
  const minRate = goal.dailyTarget > 1200 ? 2.5 : 2.0;
  return { minRate, minPayout };
}
