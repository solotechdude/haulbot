import { Hono } from "hono";
import { issueMagicLinkToken, soloPortalUrl, verifyMagicLinkToken } from "../auth/magic-link";
import { issueSessionToken } from "../auth/session";
import { getDb } from "../db";
import { sendSignInEmail } from "../email/mailer";

export const authRoutes = new Hono();

authRoutes.post("/request-login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const rawEmail = body && typeof body.email === "string" ? body.email : "";

  if (!rawEmail.includes("@")) return c.json({ ok: true });

  const normalized = rawEmail.trim().toLowerCase();
  const db = await getDb();
  const user = await db.collection("users").findOne({ email: normalized });

  if (user?.id) {
    try {
      const token = await issueMagicLinkToken(String(user.id));
      await sendSignInEmail(normalized, soloPortalUrl(token));
    } catch (err) {
      console.error("[auth] request-login failed:", err);
    }
  }

  return c.json({ ok: true });
});

authRoutes.get("/magic-link", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "MISSING_TOKEN" }, 400);

  const userId = await verifyMagicLinkToken(token);
  if (!userId) return c.json({ error: "INVALID_TOKEN" }, 401);

  return c.json({ userId, sessionToken: issueSessionToken(userId) });
});
