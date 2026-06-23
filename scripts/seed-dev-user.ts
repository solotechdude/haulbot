#!/usr/bin/env bun
/** Seed a dev user for local /solo portal testing */

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/relaybooking";
const userId = "dev-user-1";
const email = "dev@relaybooking.local";

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
      updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
    },
  },
  { upsert: true },
);

console.log(`Seeded dev user ${userId} (${email})`);
await client.close();
