import { Hono } from "hono";
import { createSoloCheckoutSession } from "../stripe/checkout";

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
