import { Hono } from "hono";
import { issueTelegramLinkToken } from "../auth/magic-link";
import { ensureProvisionedIfSubscribed } from "../provisioning";
import { telegramDeepLinkUrl } from "../telegram/link";
import { getDriverProfile } from "../onboarding";

export const onboardingRoutes = new Hono();

function requireUserId(c: { req: { header: (name: string) => string | undefined } }): string | null {
  return c.req.header("x-user-id") ?? null;
}

onboardingRoutes.get("/status", async (c) => {
  const userId = requireUserId(c);
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  await ensureProvisionedIfSubscribed(userId);
  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json(profile);
});

onboardingRoutes.get("/telegram-deeplink", async (c) => {
  const userId = requireUserId(c);
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const token = await issueTelegramLinkToken(userId);
  return c.json({ url: telegramDeepLinkUrl(token) });
});

/** Dev stub — prefer Telegram deep link in production */
onboardingRoutes.post("/telegram-link", async (c) => {
  const userId = requireUserId(c);
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

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
