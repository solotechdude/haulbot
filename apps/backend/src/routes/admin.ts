import { Hono } from "hono";
import { getDb } from "../db";
import { requireAdminToken } from "../middleware/auth";
import { getDriverProfile } from "../onboarding";

/** A1–A3 — Product Admin control room. Single internal operator. */
export const adminRoutes = new Hono();

adminRoutes.use("*", requireAdminToken());

adminRoutes.get("/customers", async (c) => {
  const db = await getDb();
  const users = await db.collection("users").find({}).sort({ createdAt: -1 }).limit(200).toArray();

  const customers = await Promise.all(
    users.map(async (user) => {
      const userId = String(user.id);
      const [subscription, env, state] = await Promise.all([
        db.collection("subscriptions").findOne({ userId }),
        db.collection("provisioned_environments").findOne({ userId }),
        db.collection("dispatch_states").findOne({ userId }),
      ]);
      const profile = await getDriverProfile(userId);

      return {
        userId,
        email: String(user.email ?? ""),
        createdAt: user.createdAt ?? null,
        subscriptionStatus: subscription?.status ?? "none",
        onboardingStep: profile?.onboardingStep ?? "subscribed",
        provisionState: env?.provisionState ?? "none",
        paused: Boolean(state?.paused),
        heartbeatAt: state?.heartbeatAt ?? null,
        activeLeg: state?.activeLeg
          ? {
              mode: state.activeLeg.mode,
              origin: state.activeLeg.searchCriteria?.origin ?? null,
              destination: state.activeLeg.searchCriteria?.destination ?? null,
            }
          : null,
        commitmentLoadId: state?.commitment?.loadId ?? null,
      };
    }),
  );

  return c.json({ customers });
});

adminRoutes.get("/customers/:userId", async (c) => {
  const userId = c.req.param("userId");
  const db = await getDb();

  const user = await db.collection("users").findOne({ id: userId });
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const [profile, subscription, env, state, plan, events, alerts, bookings, telemetryCount] =
    await Promise.all([
      getDriverProfile(userId),
      db.collection("subscriptions").findOne({ userId }),
      db.collection("provisioned_environments").findOne({ userId }),
      db.collection("dispatch_states").findOne({ userId }),
      db.collection("dispatch_plans").findOne({ userId }),
      db.collection("environment_events").find({ userId }).sort({ createdAt: -1 }).limit(50).toArray(),
      db.collection("relay_alerts").find({ userId }).sort({ createdAt: -1 }).limit(25).toArray(),
      db.collection("booking_completions").find({ userId }).sort({ createdAt: -1 }).limit(25).toArray(),
      db.collection("load_telemetry").countDocuments({ userId }),
    ]);

  const strip = <T extends { _id?: unknown }>(doc: T | null) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  };

  return c.json({
    profile,
    subscription: strip(subscription),
    environment: strip(env),
    dispatchState: strip(state),
    dispatchPlan: strip(plan),
    events: events.map(strip),
    alerts: alerts.map(strip),
    bookings: bookings.map(strip),
    telemetryCount,
  });
});

/** Support action — clear a wedged commitment (driver can't /complete) */
adminRoutes.post("/customers/:userId/clear-commitment", async (c) => {
  const userId = c.req.param("userId");
  const db = await getDb();

  const result = await db.collection("dispatch_states").updateOne(
    { userId },
    { $set: { commitment: null, updatedAt: new Date().toISOString() } },
  );
  if (result.matchedCount === 0) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({ ok: true });
});

/** Support action — pause/resume a driver's agent */
adminRoutes.post("/customers/:userId/paused", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ paused?: boolean }>().catch(() => ({ paused: undefined }));
  if (typeof body.paused !== "boolean") return c.json({ error: "INVALID_REQUEST" }, 400);

  const db = await getDb();
  const result = await db.collection("dispatch_states").updateOne(
    { userId },
    { $set: { paused: body.paused, updatedAt: new Date().toISOString() } },
  );
  if (result.matchedCount === 0) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({ ok: true, paused: body.paused });
});
