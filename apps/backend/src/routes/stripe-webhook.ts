import { Hono } from "hono";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "../stripe/client";
import {
  upsertSubscriptionFromCheckout,
  upsertSubscriptionFromStripe,
} from "../stripe/subscriptions";

export const stripeWebhookRoutes = new Hono();

stripeWebhookRoutes.post("/stripe", async (c) => {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return c.json({ error: "STRIPE_NOT_CONFIGURED" }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "MISSING_SIGNATURE" }, 400);

  const body = await c.req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.warn("[stripe] webhook signature failed:", (err as Error).message);
    return c.json({ error: "INVALID_SIGNATURE" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed":
      await upsertSubscriptionFromCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return c.json({ received: true });
});
