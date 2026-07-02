import type { Commitment, PendingAdoption } from "@relaybooking/shared";
import { getDispatchState, upsertDispatchState } from "../db";
import { sendTelegramMessage } from "../telegram/notify";

export interface ExternalBookingInput {
  userId: string;
  loadId: string;
  idKind?: "trip" | "order";
  payout?: number;
  ratePerMile?: number;
  origin?: string;
  destination?: string;
}

export async function reportExternalBooking(input: ExternalBookingInput): Promise<void> {
  const state = await getDispatchState(input.userId);
  const now = new Date().toISOString();

  if (state?.commitment?.loadId === input.loadId) return;

  const suppressed = new Set(state?.suppressedExternalBookings ?? []);
  if (suppressed.has(input.loadId)) return;

  const pending: PendingAdoption = {
    loadId: input.loadId,
    idKind: input.idKind,
    payout: input.payout,
    ratePerMile: input.ratePerMile,
    detectedAt: now,
    source: "relay_ui",
  };

  const next = state ?? {
    userId: input.userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  if (next.pendingAdoption?.loadId === input.loadId) return;

  next.pendingAdoption = pending;
  next.updatedAt = now;
  await upsertDispatchState(next);

  const payout = input.payout != null ? `$${input.payout}` : "";
  const rate = input.ratePerMile != null ? `$${input.ratePerMile}/mi` : "";
  const priceLine = payout && rate ? `${payout} (${rate})` : payout || rate;

  const activeTrip = state?.commitment?.loadId;
  const intro = activeTrip
    ? `Relay shows another booking (you already track ${activeTrip}).`
    : "Relay shows a booking we did not make.";

  await sendTelegramMessage(
    input.userId,
    [intro, `ID: ${input.loadId}`, priceLine, "", "Is this your active trip?"]
      .filter(Boolean)
      .join("\n"),
    [
      [
        { text: "Yes — track this trip", callback_data: `adopt:${input.loadId}` },
        { text: "No — ignore", callback_data: "adopt:dismiss" },
      ],
    ],
  );
}

export async function adoptPendingBooking(userId: string, loadId?: string): Promise<string> {
  const state = await getDispatchState(userId);
  if (!state?.pendingAdoption) throw new Error("NO_PENDING");

  const pending = state.pendingAdoption;
  if (loadId && pending.loadId !== loadId) throw new Error("LOAD_ID_MISMATCH");

  const now = new Date().toISOString();
  const commitment: Commitment = {
    loadId: pending.loadId,
    origin: "unknown",
    destination: "unknown",
    status: "booked",
  };

  state.commitment = commitment;
  state.activeLeg = null;
  state.pendingAdoption = null;
  state.updatedAt = now;
  await upsertDispatchState(state);

  return pending.loadId;
}

export async function dismissPendingAdoption(userId: string): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state) return;

  const loadId = state.pendingAdoption?.loadId;
  state.pendingAdoption = null;
  if (loadId) {
    const suppressed = new Set(state.suppressedExternalBookings ?? []);
    suppressed.add(loadId);
    state.suppressedExternalBookings = [...suppressed].slice(-100);
  }
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);
}
