import { Hono } from "hono";
import { getDb } from "../db";
import { requireDriverSession } from "../middleware/auth";
import { createSoloCheckoutSession } from "../stripe/checkout";
import { getStripe } from "../stripe/client";

export const billingRoutes = new Hono();

billingRoutes.post("/checkout-session", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
  const email = body.email?.trim();

  if (!email || !email.includes("@")) {
    return c.json({ error: "INVALID_EMAIL" }, 400);
  }

  try {
    const result = await createSoloCheckoutSession(email);
    return c.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message === "STRIPE_NOT_CONFIGURED" || message === "STRIPE_PRICE_ID_NOT_CONFIGURED") {
      return c.json({ error: message }, 503);
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
