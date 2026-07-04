#!/usr/bin/env bun
/** Seed a dev user for local /solo portal testing */

import { MongoClient } from "mongodb";

const uri =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/haulbot";

const userId = "dev-user-1";
const email = "dev@haulbot.local";
const now = new Date().toISOString();

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

await db.collection("users").updateOne(
  { id: userId },
  {
    $set: {
      id: userId,
      email,
      relayReadyAt: null,
      updatedAt: now,
    },
  },
  { upsert: true },
);

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

console.log(`Seeded dev user ${userId} (${email}) → ${uri}`);
await client.close();
