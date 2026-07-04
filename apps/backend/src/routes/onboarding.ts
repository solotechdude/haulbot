import { Hono } from "hono";
import { issueTelegramLinkToken } from "../auth/magic-link";
import { getDispatchState } from "../db";
import { requireDriverSession } from "../middleware/auth";
import { ensureProvisionedIfSubscribed } from "../provisioning";
import { telegramDeepLinkUrl } from "../telegram/link";
import { getDriverProfile } from "../onboarding";

export const onboardingRoutes = new Hono();

onboardingRoutes.use("*", requireDriverSession());

onboardingRoutes.get("/status", async (c) => {
  const userId = c.get("userId");

  await ensureProvisionedIfSubscribed(userId);
  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json(profile);
});

onboardingRoutes.get("/agent-status", async (c) => {
  const userId = c.get("userId");
  const s = await getDispatchState(userId);
  if (!s) {
    return c.json({ running: false, paused: false, trip: null, lastScan: null, alert: null, heartbeatAt: null, updatedAt: null });
  }
  const paused = s.paused ?? false;
  const running = !paused && Boolean(s.agentStatus?.armed);
  const trip = s.commitment
    ? { origin: s.commitment.origin, destination: s.commitment.destination, status: s.commitment.status, deliveryEta: s.commitment.deliveryEta ?? null }
    : null;
  const scan = s.agentStatus?.lastScanSummary;
  const lastScan = scan
    ? { scanned: scan.scanned, booked: scan.booked, at: scan.at }
    : null;
  let alert: "reconnect_relay" | "agent_offline" | null = null;
  if (s.relayAccess) alert = "reconnect_relay";
  else if (s.watchdogAlert?.kind === "offline") alert = "agent_offline";
  return c.json({ running, paused, trip, lastScan, alert, heartbeatAt: s.heartbeatAt ?? null, updatedAt: s.updatedAt ?? null });
});

onboardingRoutes.get("/telegram-deeplink", async (c) => {
  const userId = c.get("userId");

  const token = await issueTelegramLinkToken(userId);
  return c.json({ url: telegramDeepLinkUrl(token) });
});

/** Dev stub — prefer Telegram deep link in production */
onboardingRoutes.post("/telegram-link", async (c) => {
  const userId = c.get("userId");

  const db = (await import("../db")).getDb;
  const database = await db();
  const now = new Date().toISOString();

  await database.collection("telegram_links").updateOne(
    { userId },
    {
      $set: {
        userId,
        telegramChatId: `dev-${userId}`,
        devStub: true,
        linkedAt: now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const profile = await getDriverProfile(userId);
  return c.json(profile);
});
