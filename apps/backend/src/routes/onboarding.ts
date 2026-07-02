import { Hono } from "hono";
import { issueTelegramLinkToken } from "../auth/magic-link";
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
