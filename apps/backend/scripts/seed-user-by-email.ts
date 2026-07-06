#!/usr/bin/env bun
/**
 * Seed subscription + provisioned environment for an existing user (no Stripe).
 * Unblocks /solo Step 1 when accountSetupPhase is stuck at awaiting_subscription.
 *
 * Usage:
 *   MONGODB_URI=<uri> bun run seed:user aj@truckpin.com
 *
 * Requires the user to already exist in `users` (magic-link sign-in or checkout).
 */

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/haulbot";
const email = (process.argv[2] ?? "aj@truckpin.com").trim().toLowerCase();
const now = new Date().toISOString();

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const user = await db.collection("users").findOne({ email });
if (!user?.id) {
  console.error(`No user for ${email} — sign in once via /sign-in so the user row exists.`);
  process.exit(1);
}

const userId = String(user.id);

await db.collection("subscriptions").updateOne(
  { userId },
  {
    $set: {
      userId,
      plan: "SOLO",
      status: "active",
      updatedAt: now,
    },
  },
  { upsert: true },
);

await db.collection("provisioned_environments").updateOne(
  { userId },
  {
    $set: {
      userId,
      provisionState: "ready",
      productTier: "SOLO",
      extensionInstalled: false,
      updatedAt: now,
    },
  },
  { upsert: true },
);

await db.collection("dispatch_states").updateOne(
  { userId },
  {
    $set: {
      userId,
      paused: false,
      activeLeg: null,
      commitment: null,
      updatedAt: now,
    },
  },
  { upsert: true },
);

console.log(`Seeded ${email} (${userId}) → subscription active, env ready`);
await client.close();
