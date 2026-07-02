import { Hono } from "hono";
import type {
  ActiveLeg,
  AgentStatus,
  CommitmentStatus,
  DispatchState,
  LoadTelemetryBatch,
} from "@relaybooking/shared";
import { resolveRefreshPolicy } from "@relaybooking/shared";
import { forwardLoadTelemetry } from "../analytics/engine-client";
import { recordBookingCompletion } from "../booking/completion";
import { reportExternalBooking } from "../booking/external-adoption";
import { getDb, getDispatchState, upsertDispatchState } from "../db";
import { requireExtensionAuth } from "../middleware/auth";
import { getDriverProfile } from "../onboarding";
import { recordRelayAlert, syncTripStatus } from "../relay-alerts/record";
import { syncCampaignStatusMessage } from "../telegram/campaign-status";
import { consumeRelay2faCode, getRelayCredentials } from "../vault/relay-secrets";

export const dispatcherRoutes = new Hono();

dispatcherRoutes.use("*", requireExtensionAuth());

dispatcherRoutes.get("/profile", async (c) => {
  const userId = c.get("userId");

  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json(profile);
});

/** Extension poll path — hot read of dispatch_states */
dispatcherRoutes.get("/state", async (c) => {
  const userId = c.get("userId");

  const state = await getDispatchState(userId);
  if (!state) {
    const empty: DispatchState = {
      userId,
      paused: false,
      activeLeg: null,
      commitment: null,
      refreshPolicy: resolveRefreshPolicy(),
      updatedAt: new Date().toISOString(),
    };
    return c.json(empty);
  }

  state.refreshPolicy = resolveRefreshPolicy(state.refreshPolicy);
  return c.json(state);
});

/** Backend/bot sets activeLeg — extension polls and applies on Relay */
dispatcherRoutes.patch("/state", async (c) => {
  const userId = c.get("userId");

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
  const userId = c.get("userId");

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
  const userId = c.get("userId");

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
  const userId = c.get("userId");

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
  const userId = c.get("userId");

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

/** Dispatch Agent Relay login — secrets come from Vault (dev fallback in dev) */
dispatcherRoutes.get("/relay-credentials", async (c) => {
  const userId = c.get("userId");

  const credentials = await getRelayCredentials(userId);
  if (!credentials) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json(credentials);
});

/** One-time 2FA code read — consumed on delivery */
dispatcherRoutes.get("/relay-2fa", async (c) => {
  const userId = c.get("userId");

  const code = await consumeRelay2faCode(userId);
  if (!code) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({ code });
});

/** I1 — Load Telemetry batch: store locally (TTL) and feed the analytics engine */
dispatcherRoutes.post("/telemetry", async (c) => {
  const userId = c.get("userId");

  const body = (await c.req.json<LoadTelemetryBatch>().catch(() => null)) as LoadTelemetryBatch | null;
  if (!body || !Array.isArray(body.events)) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }
  if (body.events.length > 500) return c.json({ error: "BATCH_TOO_LARGE" }, 413);

  const db = await getDb();
  const createdAt = new Date();

  if (body.events.length > 0) {
    await db.collection("load_telemetry").insertMany(
      body.events.map((event) => ({ userId, ...event, createdAt })),
      { ordered: false },
    );
  }
  if (body.boardHealth) {
    await db.collection("board_health").insertOne({ userId, ...body.boardHealth, createdAt });
  }

  void forwardLoadTelemetry(userId, body);

  return c.json({ ok: true, accepted: body.events.length });
});

/** Upcoming / trips page status sync */
dispatcherRoutes.post("/trip-status", async (c) => {
  const userId = c.get("userId");

  const body = (await c.req
    .json<{ loadId?: string; status?: CommitmentStatus }>()
    .catch(() => ({}))) as { loadId?: string; status?: CommitmentStatus };

  if (!body.loadId || !body.status) return c.json({ error: "INVALID_REQUEST" }, 400);

  await syncTripStatus(userId, { loadId: body.loadId, status: body.status });
  return c.json({ ok: true });
});
