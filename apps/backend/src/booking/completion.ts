import type { Commitment } from "@haulbot/shared";
import { resolveMarketCity } from "@haulbot/shared";
import { getDb, getDispatchState, upsertDispatchState } from "../db";
import { dismissHandoff, openHandoffOnBook } from "./handoff";

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

  if (!input.driverAssigned) {
    await db.collection("booking_completions").insertOne({
      userId: input.userId,
      loadId: input.loadId,
      origin: resolveMarketCity(input.origin),
      destination: resolveMarketCity(input.destination),
      payout: input.payout,
      ratePerMile: input.ratePerMile,
      driverAssigned: false,
      source: "extension",
      createdAt: now,
    });
    console.log("[booking] skipped handoff — driver not assigned", input.loadId);
    return;
  }

  const existing = await getDispatchState(input.userId);
  const priorLeg = existing?.activeLeg ?? null;

  const commitment: Commitment = {
    loadId: input.loadId,
    origin: resolveMarketCity(input.origin),
    destination: resolveMarketCity(input.destination),
    payout: input.payout,
    ratePerMile: input.ratePerMile,
    status: "booked",
    pickupAt: undefined,
  };

  const state = existing ?? {
    userId: input.userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  const huntingWhileOnTrip = Boolean(state.commitment);

  if (huntingWhileOnTrip) {
    state.queuedCommitment = commitment;
    state.activeLeg = null;
    state.campaignSessionId = null;
  } else {
    state.commitment = commitment;
    state.activeLeg = null;
    state.campaignSessionId = null;
  }
  state.pendingAdoption = null;
  const suppressed = new Set(state.suppressedExternalBookings ?? []);
  suppressed.add(input.loadId);
  state.suppressedExternalBookings = [...suppressed].slice(-100);
  state.updatedAt = now;
  await upsertDispatchState(state);

  if (huntingWhileOnTrip) {
    await dismissHandoff(input.userId);
    const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
    await ensureDispatchDashboardPin(input.userId);
    console.log("[booking] queued next leg", input.loadId);
    return;
  }

  await openHandoffOnBook(input.userId, {
    bookedLoadId: input.loadId,
    deliveryCity: resolveMarketCity(input.destination),
    priorLeg,
  });

  await db.collection("booking_completions").insertOne({
    userId: input.userId,
    loadId: input.loadId,
    origin: resolveMarketCity(input.origin),
    destination: resolveMarketCity(input.destination),
    payout: input.payout,
    ratePerMile: input.ratePerMile,
    driverAssigned: input.driverAssigned ?? false,
    source: "extension",
    createdAt: now,
  });

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(input.userId);
  console.log("[booking] completion recorded", input.loadId, "handoff on pinned dashboard");
}
