#!/usr/bin/env bun
/**
 * Repair corrupted booking route data (campaign criteria stored as load O/D).
 *
 * Usage:
 *   bun run fix:booking-route EMAIL LOAD_ID DESTINATION [ORIGIN] [PAYOUT] [RATE]
 *
 * Example (aj@truckpin.com trip booked Brampton → Mississauga):
 *   bun run fix:booking-route aj@truckpin.com 1PGQCXZTN MISSISSAUGA BRAMPTON 550 5.5
 *
 * Omit LOAD_ID to fix the most recent booking_completions row for the user.
 */

import { MongoClient } from "mongodb";
import { formatRouteLabel, normalizeMarketCity } from "@haulbot/shared";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/haulbot";
const email = (process.argv[2] ?? "").toLowerCase();
const loadIdArg = process.argv[3];
const destinationArg = process.argv[4];
const originArg = process.argv[5];
const payoutArg = process.argv[6] != null ? Number(process.argv[6]) : undefined;
const rateArg = process.argv[7] != null ? Number(process.argv[7]) : undefined;

if (!email || !destinationArg) {
  console.error(
    "Usage: bun run fix:booking-route EMAIL LOAD_ID DESTINATION [ORIGIN] [PAYOUT] [RATE]",
  );
  process.exit(1);
}

const destination = normalizeMarketCity(destinationArg);
const origin = originArg ? normalizeMarketCity(originArg) : undefined;

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const user = await db.collection("users").findOne({ email });
if (!user?.id) {
  console.error(`No user for ${email}`);
  process.exit(1);
}
const userId = String(user.id);

let booking = loadIdArg
  ? await db.collection("booking_completions").findOne({ userId, loadId: loadIdArg })
  : await db.collection("booking_completions").findOne(
      { userId },
      { sort: { createdAt: -1 } },
    );

if (!booking) {
  console.error("No booking_completions row found");
  process.exit(1);
}

const loadId = String(booking.loadId);
const fixedOrigin = origin ?? normalizeMarketCity(booking.origin as string | undefined);
const payout = payoutArg ?? (booking.payout as number | undefined);
const ratePerMile = rateArg ?? (booking.ratePerMile as number | undefined);
const now = new Date().toISOString();

console.log("Before:", {
  loadId,
  route: formatRouteLabel(booking.origin as string, booking.destination as string),
  payout: booking.payout,
  ratePerMile: booking.ratePerMile,
});

await db.collection("booking_completions").updateOne(
  { userId, loadId },
  {
    $set: {
      origin: fixedOrigin,
      destination,
      ...(payout != null ? { payout } : {}),
      ...(ratePerMile != null ? { ratePerMile } : {}),
      repairedAt: now,
      repairNote: "fix-booking-route script — was campaign criteria, not load row",
    },
  },
);

const state = await db.collection("dispatch_states").findOne({ userId });
if (state?.commitment?.loadId === loadId) {
  await db.collection("dispatch_states").updateOne(
    { userId },
    {
      $set: {
        "commitment.origin": fixedOrigin,
        "commitment.destination": destination,
        ...(payout != null ? { "commitment.payout": payout } : {}),
        ...(ratePerMile != null ? { "commitment.ratePerMile": ratePerMile } : {}),
        updatedAt: now,
      },
    },
  );
  console.log("Updated dispatch_states.commitment");
}

const plan = await db.collection("dispatch_plans").findOne({ userId });
if (plan?.handoff?.bookedLoadId === loadId) {
  await db.collection("dispatch_plans").updateOne(
    { userId },
    {
      $set: {
        "handoff.deliveryCity": destination,
        "handoff.draftNextLeg.searchCriteria.origin": destination,
        "handoff.draftNextLeg.searchCriteria.destination": destination,
        updatedAt: now,
      },
    },
  );
  console.log("Updated dispatch_plans.handoff draft");
}

if (state?.activeLeg && state.commitment?.loadId === loadId) {
  await db.collection("dispatch_states").updateOne(
    { userId },
    {
      $set: {
        "activeLeg.searchCriteria.origin": destination,
        "activeLeg.searchCriteria.destination": destination,
        updatedAt: now,
      },
    },
  );
  console.log("Updated dispatch_states.activeLeg (queued next leg)");
}

console.log("After:", {
  loadId,
  route: formatRouteLabel(fixedOrigin, destination),
  nextLeg: formatRouteLabel(destination, destination),
  payout,
  ratePerMile,
});

await client.close();
