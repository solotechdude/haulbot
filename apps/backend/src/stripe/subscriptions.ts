import type Stripe from "stripe";
import { trackGa4Purchase } from "../analytics/ga4-mp";
import { getDb } from "../db";
import { deprovisionEnvironment, provisionDedicatedEnvironment } from "../provisioning";

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled" || status === "unpaid") return "canceled";
  return "past_due";
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  const userId =
    subscription.metadata.userId ??
    (await db.collection("users").findOne({ stripeCustomerId: subscription.customer as string }))?.id;

  if (!userId) {
    console.warn("[stripe] subscription event without resolvable userId", subscription.id);
    return;
  }

  const now = new Date().toISOString();

  // Stripe moved `current_period_end` off the subscription and onto its items
  // in newer API versions, so read both locations defensively without relying
  // on a specific SDK type shape.
  const sub = subscription as unknown as {
    current_period_end?: unknown;
    items?: { data?: Array<{ current_period_end?: unknown }> };
  };
  const rawPeriodEnd =
    typeof sub.current_period_end === "number"
      ? sub.current_period_end
      : sub.items?.data?.[0]?.current_period_end;
  const periodEndSeconds = typeof rawPeriodEnd === "number" ? rawPeriodEnd : undefined;

  const set: Record<string, unknown> = {
    userId,
    plan: "SOLO",
    status: mapStripeStatus(subscription.status),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    updatedAt: now,
  };
  if (periodEndSeconds !== undefined && Number.isFinite(periodEndSeconds)) {
    set.currentPeriodEnd = new Date(periodEndSeconds * 1000).toISOString();
  }

  await db.collection("subscriptions").updateOne(
    { userId },
    {
      $set: set,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const status = mapStripeStatus(subscription.status);
  if (status === "active") {
    await provisionDedicatedEnvironment(userId);
  } else if (status === "canceled") {
    await deprovisionEnvironment(userId);
  }
}

export async function upsertSubscriptionFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const db = await getDb();
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    console.warn("[stripe] checkout session without userId metadata", session.id);
    return;
  }

  const now = new Date().toISOString();
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        id: userId,
        email: session.customer_details?.email ?? session.customer_email ?? undefined,
        stripeCustomerId: customerId,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  if (session.subscription && typeof session.subscription === "string") {
    await db.collection("subscriptions").updateOne(
      { userId },
      {
        $set: {
          userId,
          plan: "SOLO",
          status: "active",
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: customerId,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    await provisionDedicatedEnvironment(userId);
    await trackGa4Purchase({ userId, transactionId: session.id });
  }
}
