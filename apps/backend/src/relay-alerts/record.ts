import type { CommitmentStatus } from "@relaybooking/shared";
import { getDb, getDispatchState, upsertDispatchState } from "../db";
import { sendTelegramMessage } from "../telegram/notify";

export type RelayAlertType = "canceled" | "schedule_change" | "filled";

export interface RelayAlertInput {
  userId: string;
  type: RelayAlertType;
  loadId?: string;
  message?: string;
}

async function isDuplicateAlert(userId: string, type: string, loadId?: string): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const existing = await db.collection("relay_alerts").findOne({
    userId,
    type,
    loadId: loadId ?? null,
    createdAt: { $gte: since },
  });
  return Boolean(existing);
}

export async function recordRelayAlert(input: RelayAlertInput): Promise<void> {
  if (await isDuplicateAlert(input.userId, input.type, input.loadId)) return;

  const db = await getDb();
  const now = new Date().toISOString();

  await db.collection("relay_alerts").insertOne({
    userId: input.userId,
    type: input.type,
    loadId: input.loadId,
    message: input.message,
    createdAt: now,
  });

  const state = await getDispatchState(input.userId);
  if (!state) return;

  const matchesCommitment =
    input.loadId &&
    state.commitment &&
    (state.commitment.loadId === input.loadId ||
      state.commitment.loadId.includes(input.loadId) ||
      input.loadId.includes(state.commitment.loadId));

  if (input.type === "canceled" && matchesCommitment) {
    state.commitment = null;
    state.updatedAt = now;
    await upsertDispatchState(state);

    await sendTelegramMessage(
      input.userId,
      `Load canceled on Relay.\nTrip: ${input.loadId}\n\nCommitment cleared. You can start a new campaign.`,
    );
    return;
  }

  if (input.type === "canceled") {
    await sendTelegramMessage(
      input.userId,
      `Relay alert: load canceled${input.loadId ? `\nTrip: ${input.loadId}` : ""}.\n${input.message ?? ""}`.trim(),
    );
    return;
  }

  if (input.type === "schedule_change") {
    await sendTelegramMessage(
      input.userId,
      `Relay schedule change${input.loadId ? ` for ${input.loadId}` : ""}.\n${input.message ?? "Check Relay for details."}`,
    );
  }
}

export async function syncTripStatus(
  userId: string,
  input: { loadId: string; status: CommitmentStatus; origin?: string; destination?: string },
): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state?.commitment) return;

  const id = state.commitment.loadId;
  if (input.loadId !== id && !id.includes(input.loadId) && !input.loadId.includes(id)) return;

  const now = new Date().toISOString();
  state.commitment.status = input.status;

  if (input.status === "canceled") {
    state.commitment = null;
    await upsertDispatchState(state);
    await sendTelegramMessage(userId, `Trip ${input.loadId} canceled on Relay. Commitment cleared.`);
    return;
  }

  if (input.status === "delivered") {
    await upsertDispatchState(state);
    await sendTelegramMessage(
      userId,
      `Trip ${input.loadId} marked delivered on Relay.\nReply /complete when you're done with post-book ops.`,
    );
    return;
  }

  if (input.status === "picked_up") {
    await upsertDispatchState(state);
    await sendTelegramMessage(userId, `Trip ${input.loadId} picked up.`);
  }
}
