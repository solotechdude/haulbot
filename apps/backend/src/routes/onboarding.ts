import { Hono } from "hono";
import { issueTelegramLinkToken } from "../auth/magic-link";
import { getDb, getDispatchState } from "../db";
import { requireDriverSession } from "../middleware/auth";
import { ensureProvisionedIfSubscribed, provisionDedicatedEnvironment } from "../provisioning";
import { buildPortalAgentStatus, mapBookingHistory } from "../portal/agent-status";
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

onboardingRoutes.post("/retry-provision", async (c) => {
  const userId = c.get("userId");
  const db = await getDb();
  const subscription = await db.collection("subscriptions").findOne({ userId, status: "active" });
  if (!subscription) {
    return c.json({ error: "NO_SUBSCRIPTION" }, 400);
  }

  try {
    await provisionDedicatedEnvironment(userId);
  } catch {
    /* profile below reflects failed state */
  }

  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(profile);
});

onboardingRoutes.get("/agent-status", async (c) => {
  const userId = c.get("userId");
  const state = await getDispatchState(userId);

  const bookingByLoadId = new Map<string, { payout?: number; ratePerMile?: number }>();
  if (state?.commitment?.loadId) {
    const db = await getDb();
    const row = await db.collection("booking_completions").findOne({
      userId,
      loadId: state.commitment.loadId,
    });
    if (row) {
      bookingByLoadId.set(state.commitment.loadId, {
        payout: row.payout as number | undefined,
        ratePerMile: row.ratePerMile as number | undefined,
      });
    }
  }

  return c.json(buildPortalAgentStatus(state, bookingByLoadId));
});

onboardingRoutes.get("/booking-history", async (c) => {
  const userId = c.get("userId");
  const period = c.req.query("period") ?? "all";
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);

  const since = (() => {
    const now = Date.now();
    if (period === "week") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (period === "month") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    return null;
  })();

  const db = await getDb();
  const filter: Record<string, unknown> = { userId };
  if (since) filter.createdAt = { $gte: since };

  const rows = await db
    .collection("booking_completions")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return c.json(
    mapBookingHistory(
      rows as Array<{
        loadId?: string;
        origin?: string;
        destination?: string;
        payout?: number;
        ratePerMile?: number;
        createdAt?: string;
      }>,
    ),
  );
});

onboardingRoutes.get("/telegram-deeplink", async (c) => {
  const userId = c.get("userId");

  const token = await issueTelegramLinkToken(userId);
  return c.json({ url: telegramDeepLinkUrl(token) });
});
