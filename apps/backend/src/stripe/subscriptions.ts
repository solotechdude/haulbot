import type Stripe from "stripe";
import { getDb } from "../db";
import { provisionDedicatedEnvironment } from "../provisioning";

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
  await db.collection("subscriptions").updateOne(
    { userId },
    {
      $set: {
        userId,
        plan: "SOLO",
        status: mapStripeStatus(subscription.status),
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  if (mapStripeStatus(subscription.status) === "active") {
    await provisionDedicatedEnvironment(userId);
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
  }
}
