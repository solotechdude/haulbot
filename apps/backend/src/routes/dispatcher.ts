import { Hono } from "hono";
import type { ActiveLeg, AgentStatus, CommitmentStatus, DispatchState } from "@relaybooking/shared";
import { recordBookingCompletion } from "../booking/completion";
import { reportExternalBooking } from "../booking/external-adoption";
import { getDispatchState, upsertDispatchState } from "../db";
import { getDriverProfile } from "../onboarding";
import { recordRelayAlert, syncTripStatus } from "../relay-alerts/record";
import { syncCampaignStatusMessage } from "../telegram/campaign-status";

export const dispatcherRoutes = new Hono();

dispatcherRoutes.get("/profile", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json(profile);
});

/** Extension poll path — hot read of dispatch_states */
dispatcherRoutes.get("/state", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const state = await getDispatchState(userId);
  if (!state) {
    const empty: DispatchState = {
      userId,
      paused: false,
      activeLeg: null,
      commitment: null,
      updatedAt: new Date().toISOString(),
    };
    return c.json(empty);
  }

  return c.json(state);
});

/** Backend/bot sets activeLeg — extension polls and applies on Relay */
dispatcherRoutes.patch("/state", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{ paused?: boolean; activeLeg?: ActiveLeg | null }>()
    .catch(() => ({}))) as { paused?: boolean; activeLeg?: ActiveLeg | null };
  const now = new Date().toISOString();
  const existing = await getDispatchState(userId);

  const state: DispatchState = existing ?? {
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  if (typeof body.paused === "boolean") state.paused = body.paused;
  if (body.activeLeg !== undefined) state.activeLeg = body.activeLeg;
  state.updatedAt = now;

  await upsertDispatchState(state);
  return c.json(state);
});

dispatcherRoutes.patch("/state/heartbeat", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{
      relayWorkState?: AgentStatus["relayWorkState"];
      armed?: boolean;
      lastScanSummary?: AgentStatus["lastScanSummary"];
    }>()
    .catch(() => ({}))) as {
    relayWorkState?: AgentStatus["relayWorkState"];
    armed?: boolean;
    lastScanSummary?: AgentStatus["lastScanSummary"];
  };

  const now = new Date().toISOString();
  const existing = await getDispatchState(userId);
  const prevAgentStatus = existing?.agentStatus ?? null;

  const state: DispatchState = existing ?? {
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  if (body.relayWorkState) {
    state.agentStatus = {
      relayWorkState: body.relayWorkState,
      armed: Boolean(body.armed),
      lastScanSummary: body.lastScanSummary ?? state.agentStatus?.lastScanSummary,
      updatedAt: now,
    };
  }

  state.heartbeatAt = now;
  state.updatedAt = now;
  await upsertDispatchState(state);

  if (state.agentStatus) {
    void syncCampaignStatusMessage(userId, state, prevAgentStatus);
  }

  return c.json({ ok: true, heartbeatAt: now });
});

/** E3 — extension reports book outcome (driver assigns in Relay) */
dispatcherRoutes.post("/booking-completion", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{
      loadId?: string;
      origin?: string;
      destination?: string;
      payout?: number;
      ratePerMile?: number;
      driverAssigned?: boolean;
    }>()
    .catch(() => ({}))) as {
    loadId?: string;
    origin?: string;
    destination?: string;
    payout?: number;
    ratePerMile?: number;
    driverAssigned?: boolean;
  };

  if (!body.loadId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await recordBookingCompletion({
    userId,
    loadId: body.loadId,
    origin: body.origin,
    destination: body.destination,
    payout: body.payout,
    ratePerMile: body.ratePerMile,
    driverAssigned: body.driverAssigned ?? false,
  });

  return c.json({ ok: true });
});

/** E4 — extension forwards Relay cancel / schedule alerts */
dispatcherRoutes.post("/relay-alert", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{ type?: string; loadId?: string; message?: string }>()
    .catch(() => ({}))) as { type?: string; loadId?: string; message?: string };

  if (!body.type) return c.json({ error: "INVALID_REQUEST" }, 400);

  await recordRelayAlert({
    userId,
    type: body.type as "canceled" | "schedule_change" | "filled",
    loadId: body.loadId,
    message: body.message,
  });

  return c.json({ ok: true });
});

/** External / manual booking detected on Relay — ask driver before adopting */
dispatcherRoutes.post("/external-booking", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{
      loadId?: string;
      idKind?: "trip" | "order";
      payout?: number;
      ratePerMile?: number;
    }>()
    .catch(() => ({}))) as {
    loadId?: string;
    idKind?: "trip" | "order";
    payout?: number;
    ratePerMile?: number;
  };

  if (!body.loadId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await reportExternalBooking({
    userId,
    loadId: body.loadId,
    idKind: body.idKind,
    payout: body.payout,
    ratePerMile: body.ratePerMile,
  });

  return c.json({ ok: true });
});

/** Upcoming / trips page status sync */
dispatcherRoutes.post("/trip-status", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = (await c.req
    .json<{ loadId?: string; status?: CommitmentStatus }>()
    .catch(() => ({}))) as { loadId?: string; status?: CommitmentStatus };

  if (!body.loadId || !body.status) return c.json({ error: "INVALID_REQUEST" }, 400);

  await syncTripStatus(userId, { loadId: body.loadId, status: body.status });
  return c.json({ ok: true });
});
