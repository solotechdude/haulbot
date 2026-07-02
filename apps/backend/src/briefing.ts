import { fetchLaneInsights, isEngineConfigured } from "./analytics/engine-client";
import { getDb } from "./db";
import { sendTelegramMessage } from "./telegram/notify";

/**
 * O4 — morning briefing: Market Intelligence for each active driver's lane,
 * sent once per UTC day at BRIEFING_UTC_HOUR (default 12:00 UTC ≈ US morning).
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function briefingHourUtc(): number {
  const hour = Number(process.env.BRIEFING_UTC_HOUR ?? 12);
  return Number.isFinite(hour) ? hour : 12;
}

async function sendMorningBriefings(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const today = now.toISOString().slice(0, 10);

  const states = await db
    .collection("dispatch_states")
    .find({ paused: false, activeLeg: { $ne: null } })
    .toArray();

  let sent = 0;
  for (const state of states) {
    const userId = String(state.userId);
    const user = await db.collection("users").findOne({ id: userId });
    if (!user || user.lastBriefingAt === today) continue;

    const leg = state.activeLeg as {
      searchCriteria?: { origin?: string; destination?: string };
    } | null;
    const origin = leg?.searchCriteria?.origin;
    if (!origin) continue;

    const insights = await fetchLaneInsights(origin, leg?.searchCriteria?.destination);

    const lines = [`Morning briefing — ${origin}`];
    if (insights?.avgRatePerMile) lines.push(`Avg rate: $${insights.avgRatePerMile.toFixed(2)}/mi`);
    if (insights?.avgPayout) lines.push(`Avg payout: $${Math.round(insights.avgPayout)}`);
    if (insights?.dailyLoadVolume) lines.push(`Volume: ~${insights.dailyLoadVolume} loads/day`);
    if (insights?.recommendation) lines.push(`Tip: ${insights.recommendation}`);
    if (lines.length === 1) lines.push("Agent is armed and scanning. /status for details.");

    const delivered = await sendTelegramMessage(userId, lines.join("\n"));
    if (delivered) {
      await db.collection("users").updateOne({ id: userId }, { $set: { lastBriefingAt: today } });
      sent += 1;
    }
  }

  return sent;
}

export function startMorningBriefingLoop(): void {
  if (!isEngineConfigured() && process.env.BRIEFING_ENABLED !== "true") {
    console.log("[briefing] disabled — set ANALYTICS_ENGINE_URL or BRIEFING_ENABLED=true");
    return;
  }

  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() !== briefingHourUtc()) return;
    void sendMorningBriefings(now).catch((err) =>
      console.warn("[briefing] failed:", (err as Error).message),
    );
  }, CHECK_INTERVAL_MS);

  console.log("[briefing] loop started — daily at %d:00 UTC", briefingHourUtc());
}
