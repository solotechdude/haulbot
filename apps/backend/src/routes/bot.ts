import { Hono } from "hono";
import { verifyTelegramLinkToken } from "../auth/magic-link";
import { requireServiceToken } from "../middleware/auth";
import { getUserIdByTelegramChat, linkTelegramChat } from "../telegram/link";
import { storeRelay2faCode, storeRelayCredentials } from "../vault/relay-secrets";

export const botRoutes = new Hono();

botRoutes.use("*", requireServiceToken());

botRoutes.post("/telegram/link", async (c) => {
  const body = await c.req.json<{
    token?: string;
    telegramChatId?: string;
    telegramUsername?: string;
  }>();

  if (!body.token || !body.telegramChatId) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const userId = await verifyTelegramLinkToken(body.token);
  if (!userId) return c.json({ error: "INVALID_TOKEN" }, 401);

  await linkTelegramChat({
    userId,
    telegramChatId: body.telegramChatId,
    telegramUsername: body.telegramUsername,
  });

  return c.json({ ok: true, userId });
});

botRoutes.get("/user-by-chat/:chatId", async (c) => {
  const userId = await getUserIdByTelegramChat(c.req.param("chatId"));
  if (!userId) return c.json({ error: "NOT_LINKED" }, 404);
  return c.json({ userId });
});

botRoutes.post("/relay/credentials", async (c) => {
  const body = await c.req.json<{
    userId?: string;
    email?: string;
    password?: string;
  }>();

  if (!body.userId || !body.email || !body.password) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const result = await storeRelayCredentials(body.userId, {
    email: body.email.trim(),
    password: body.password,
  });

  return c.json({ ok: true, require2fa: result.require2fa });
});

botRoutes.post("/relay/2fa", async (c) => {
  const body = await c.req.json<{ userId?: string; code?: string }>();
  if (!body.userId || !body.code) return c.json({ error: "INVALID_REQUEST" }, 400);

  await storeRelay2faCode(body.userId, body.code.trim());
  return c.json({ ok: true });
});
