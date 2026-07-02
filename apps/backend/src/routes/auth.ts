import { Hono } from "hono";
import { verifyMagicLinkToken } from "../auth/magic-link";

export const authRoutes = new Hono();

authRoutes.get("/magic-link", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "MISSING_TOKEN" }, 400);

  const userId = await verifyMagicLinkToken(token);
  if (!userId) return c.json({ error: "INVALID_TOKEN" }, 401);

  return c.json({ userId });
});
