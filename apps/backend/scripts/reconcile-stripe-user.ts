#!/usr/bin/env bun
/** Reconcile Stripe subscription → MongoDB when webhooks were missed locally */

import { MongoClient } from "mongodb";
import Stripe from "stripe";

const email = process.argv[2] ?? "aj@truckpin.com";
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/relaybooking_solo";
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error("STRIPE_SECRET_KEY required");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
const customer = customers.data[0];
if (!customer) {
  console.error(`No Stripe customer for ${email}`);
  process.exit(1);
}

const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: "all" });
const subscription = subs.data[0];
if (!subscription) {
  console.error(`No Stripe subscription for ${email}`);
  process.exit(1);
}

const userId =
  subscription.metadata.userId ??
  (await stripe.checkout.sessions.list({ customer: customer.id, limit: 1 })).data[0]?.client_reference_id;

if (!userId) {
  console.error("Could not resolve userId from Stripe metadata");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const now = new Date().toISOString();

await db.collection("users").updateOne(
  { id: userId },
  {
    $set: {
      id: userId,
      email: email.toLowerCase(),
      stripeCustomerId: customer.id,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);

await db.collection("subscriptions").updateOne(
  { userId },
  {
    $set: {
      userId,
      plan: "SOLO",
      status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);

await client.close();

// Provision via backend module
const { provisionDedicatedEnvironment } = await import("../src/provisioning.ts");
await provisionDedicatedEnvironment(userId);

console.log(`Reconciled ${email} (${userId}) — subscription ${subscription.id}, env provisioned`);
process.exit(0);
