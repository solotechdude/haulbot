import type { Commitment } from "@relaybooking/shared";
import { getDb, getDispatchState, upsertDispatchState } from "../db";
import { sendTelegramMessage } from "../telegram/notify";
import { openHandoffOnBook } from "./handoff";

export interface BookingCompletionInput {
  userId: string;
  loadId: string;
  origin?: string;
  destination?: string;
  payout?: number;
  ratePerMile?: number;
  driverAssigned?: boolean;
}

export async function recordBookingCompletion(input: BookingCompletionInput): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const commitment: Commitment = {
    loadId: input.loadId,
    origin: input.origin ?? "unknown",
    destination: input.destination ?? "unknown",
    status: "booked",
  };

  const existing = await getDispatchState(input.userId);
  const priorLeg = existing?.activeLeg ?? null;

  const state = existing ?? {
    userId: input.userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  state.commitment = commitment;
  state.activeLeg = null;
  state.campaignSessionId = null;
  state.pendingAdoption = null;
  const suppressed = new Set(state.suppressedExternalBookings ?? []);
  suppressed.add(input.loadId);
  state.suppressedExternalBookings = [...suppressed].slice(-100);
  state.updatedAt = now;
  await upsertDispatchState(state);

  await openHandoffOnBook(input.userId, {
    bookedLoadId: input.loadId,
    deliveryCity: input.destination ?? "unknown",
    priorLeg,
  });

  await db.collection("booking_completions").insertOne({
    userId: input.userId,
    loadId: input.loadId,
    origin: input.origin,
    destination: input.destination,
    payout: input.payout,
    ratePerMile: input.ratePerMile,
    driverAssigned: input.driverAssigned ?? false,
    source: "extension",
    createdAt: now,
  });

  const origin = input.origin ?? "?";
  const dest = input.destination ?? "?";
  const payout = input.payout != null ? `$${input.payout}` : "";
  const rate = input.ratePerMile != null ? `$${input.ratePerMile}/mi` : "";
  const deliveryCity = dest.toUpperCase();

  const msg = [
    "Load booked — assign driver in Relay when ready.",
    `Trip: ${input.loadId}`,
    `${origin} → ${dest}`,
    payout && rate ? `${payout} (${rate})` : payout || rate,
    "",
    `When do you want your next load in ${deliveryCity}?`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendTelegramMessage(input.userId, msg, [
    [
      { text: "+1 hour", callback_data: "handoff:+1h" },
      { text: "+3 hours", callback_data: "handoff:+3h" },
    ],
    [{ text: "Tomorrow 8am", callback_data: "handoff:tomorrow8" }],
    [{ text: "Custom time…", callback_data: "handoff:custom" }],
    [{ text: "Edit route…", callback_data: "handoff:tune" }],
    [{ text: "Later — /campaign", callback_data: "handoff:skip" }],
  ]);
  console.log("[booking] completion recorded", input.loadId, "handoff opened");
}
