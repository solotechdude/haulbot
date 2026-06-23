import { Hono } from "hono";
import type { DispatchState } from "@relaybooking/shared";
import { getDispatchState, upsertDispatchState } from "../db";
import { getDriverProfile } from "../onboarding";

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

dispatcherRoutes.patch("/state/heartbeat", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const now = new Date().toISOString();
  const existing = await getDispatchState(userId);

  const state: DispatchState = existing ?? {
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  state.heartbeatAt = now;
  state.updatedAt = now;
  await upsertDispatchState(state);

  return c.json({ ok: true, heartbeatAt: now });
});
