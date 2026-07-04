#!/usr/bin/env bun
/**
 * Set a campaign activeLeg for dev testing (bypasses Telegram bot).
 *
 * Usage:
 *   bun run set:campaign EMAIL ORIGIN minRate minPayout [DESTINATION]
 *
 * Examples:
 *   bun run set:campaign aj@truckpin.com BRAMPTON 3 200
 *     → BRAMPTON → anywhere (destination defaults to origin)
 *   bun run set:campaign aj@truckpin.com DFW 2.5 800 ATL
 *     → DFW → ATL
 *
 * See docs/campaign-bot-flow.md for the Telegram wizard flow.
 */

import { MongoClient } from "mongodb";
import type { ActiveLeg } from "@haulbot/shared";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/haulbot";
const email = process.argv[2] ?? "aj@truckpin.com";
const origin = (process.argv[3] ?? "DFW").toUpperCase();
const minRate = process.argv[4] != null ? Number(process.argv[4]) : 2.5;
const minPayout = process.argv[5] != null ? Number(process.argv[5]) : 800;
const destination = (process.argv[6] ?? origin).toUpperCase();

const activeLeg: ActiveLeg = {
  mode: "campaign",
  searchCriteria: {
    origin,
    destination,
    radius: 50,
  },
  hardRules: {
    minRate,
    minPayout,
  },
  bookPriority: "payout_then_rate",
};

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const user = await db.collection("users").findOne({ email: email.toLowerCase() });
if (!user?.id) {
  console.error(`No user for ${email}`);
  process.exit(1);
}

const userId = String(user.id);
const now = new Date().toISOString();

await db.collection("dispatch_states").updateOne(
  { userId },
  {
    $set: {
      userId,
      paused: false,
      activeLeg,
      commitment: null,
      campaignSessionId: crypto.randomUUID(),
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true },
);

const route =
  destination === origin ? `${origin} → anywhere` : `${origin} → ${destination}`;
console.log(`Campaign set for ${email} (${userId}): ${route}, $${minRate}/mi, $${minPayout} min`);
await client.close();
