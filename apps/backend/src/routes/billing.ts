import { Hono } from "hono";
import { TERMS_VERSION } from "@haulbot/shared";
import { getDb } from "../db";
import { requireDriverSession } from "../middleware/auth";
import { createSoloCheckoutSession } from "../stripe/checkout";
import { getStripe } from "../stripe/client";

export const billingRoutes = new Hono();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return c.req.header("x-real-ip") ?? c.req.header("cf-connecting-ip");
}

billingRoutes.post("/checkout-session", async (c) => {
  const body = await c.req
    .json<{ email?: string; termsAccepted?: boolean; termsVersion?: string }>()
    .catch(() => ({ email: undefined, termsAccepted: undefined, termsVersion: undefined }));
  const email = body.email?.trim();

  if (!email || !email.includes("@")) {
    return c.json({ error: "INVALID_EMAIL" }, 400);
  }

  if (!body.termsAccepted || body.termsVersion !== TERMS_VERSION) {
    return c.json({ error: "TERMS_NOT_ACCEPTED" }, 400);
  }

  const acceptedAt = new Date().toISOString();
  const acceptedIp = clientIp(c);

  try {
    const result = await createSoloCheckoutSession(email, {
      version: TERMS_VERSION,
      acceptedAt,
      acceptedIp,
    });
    return c.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message === "STRIPE_NOT_CONFIGURED" || message === "STRIPE_PRICE_ID_NOT_CONFIGURED") {
      return c.json({ error: message }, 503);
    }
    if (message === "TERMS_VERSION_MISMATCH") {
      return c.json({ error: "TERMS_NOT_ACCEPTED" }, 400);
    }
    console.error("[billing] checkout-session failed:", message);
    return c.json({ error: "CHECKOUT_FAILED" }, 500);
  }
});

billingRoutes.get("/summary", requireDriverSession(), async (c) => {
  const userId = c.get("userId");
  const db = await getDb();
  const sub = await db.collection("subscriptions").findOne({ userId });

  if (!sub) {
    return c.json({ status: "none" });
  }

  return c.json({
    plan: sub.plan,
    status: sub.status,
    ...(typeof sub.currentPeriodEnd === "string"
      ? { currentPeriodEnd: sub.currentPeriodEnd }
      : {}),
    ...(typeof sub.cancelAtPeriodEnd === "boolean"
      ? { cancelAtPeriodEnd: sub.cancelAtPeriodEnd }
      : {}),
  });
});

billingRoutes.post("/portal-session", requireDriverSession(), async (c) => {
  const stripe = getStripe();
  if (!stripe) {
    return c.json({ error: "STRIPE_NOT_CONFIGURED" }, 503);
  }

  const userId = c.get("userId");
  const db = await getDb();

  const sub = await db.collection("subscriptions").findOne({ userId });
  let stripeCustomerId: string | undefined =
    typeof sub?.stripeCustomerId === "string" ? sub.stripeCustomerId : undefined;

  if (!stripeCustomerId) {
    const user = await db.collection("users").findOne({ id: userId });
    if (typeof user?.stripeCustomerId === "string") {
      stripeCustomerId = user.stripeCustomerId;
    }
  }

  if (!stripeCustomerId) {
    return c.json({ error: "NO_CUSTOMER" }, 400);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.WEBSITE_URL ?? "http://localhost:3000"}/solo`,
    });
    return c.json({ url: session.url });
  } catch (err) {
    console.error("[billing] portal-session failed:", (err as Error).message);
    return c.json({ error: "PORTAL_FAILED" }, 500);
  }
});
