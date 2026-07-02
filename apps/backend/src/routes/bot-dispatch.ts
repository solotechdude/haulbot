import { Hono } from "hono";
import type { ActiveLeg } from "@relaybooking/shared";
import { completeCommitment } from "../booking/complete-commitment";
import { adoptPendingBooking, dismissPendingAdoption } from "../booking/external-adoption";
import {
  completeHandoffReadiness,
  dismissHandoff,
  getPendingHandoff,
  updateHandoffDraft,
} from "../booking/handoff";
import { getDispatchState, upsertDispatchState } from "../db";
import { getDriverProfile } from "../onboarding";
import { requireServiceToken } from "../middleware/auth";

export const botDispatchRoutes = new Hono();

botDispatchRoutes.use("*", requireServiceToken());

botDispatchRoutes.get("/status/:userId", async (c) => {
  const userId = c.req.param("userId");
  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  const state = await getDispatchState(userId);
  const handoff = await getPendingHandoff(userId);
  return c.json({
    profile,
    dispatch: state ?? { paused: false, activeLeg: null, commitment: null },
    handoff,
  });
});

botDispatchRoutes.post("/campaign", async (c) => {
  /** Telegram: /campaign ORIGIN minRate minPayout — see docs/campaign-bot-flow.md */
  const body = await c.req.json<{
    userId?: string;
    origin?: string;
    destination?: string;
    minRate?: number;
    minPayout?: number;
    radius?: number;
    readinessWindow?: string;
    clearCommitment?: boolean;
  }>();

  if (!body.userId || !body.origin || body.minRate == null || body.minPayout == null) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const minRate = body.minRate;
  const minPayout = body.minPayout;
  const destination = (body.destination ?? body.origin).toUpperCase();
  const now = new Date().toISOString();

  const existing = await getDispatchState(body.userId);
  if (existing?.commitment && !body.clearCommitment) {
    return c.json({
      error: "COMMITMENT_ACTIVE",
      commitment: existing.commitment,
    }, 409);
  }

  const readinessWindow = body.readinessWindow ?? now;
  const searchOpensAt = readinessWindow;

  const activeLeg: ActiveLeg = {
    mode: "campaign",
    searchCriteria: {
      origin: body.origin.toUpperCase(),
      destination,
      ...(body.radius != null ? { radius: body.radius } : {}),
    },
    hardRules: { minRate, minPayout },
    bookPriority: "payout_then_rate",
    readinessWindow,
    searchOpensAt,
  };

  const state = existing ?? {
    userId: body.userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  if (body.clearCommitment) state.commitment = null;
  state.activeLeg = activeLeg;
  state.campaignSessionId = crypto.randomUUID();
  state.paused = false;
  state.updatedAt = now;
  await upsertDispatchState(state);
  await dismissHandoff(body.userId);

  return c.json({ ok: true, activeLeg });
});

botDispatchRoutes.post("/campaign-status-pin", async (c) => {
  const body = await c.req.json<{ userId?: string; telegramChatId?: string; messageId?: number }>();
  if (!body.userId || !body.telegramChatId || !body.messageId) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const existing = await getDispatchState(body.userId);
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  existing.campaignStatusPin = {
    telegramChatId: body.telegramChatId,
    messageId: body.messageId,
  };
  existing.updatedAt = new Date().toISOString();
  await upsertDispatchState(existing);

  return c.json({ ok: true });
});

botDispatchRoutes.post("/complete", async (c) => {
  const body = await c.req.json<{ userId?: string; loadId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const result = await completeCommitment(body.userId, body.loadId);
  if ("error" in result) {
    const status = result.error === "NO_COMMITMENT" ? 404 : 409;
    return c.json({ error: result.error }, status);
  }

  return c.json({ ok: true, clearedLoadId: result.clearedLoadId });
});

botDispatchRoutes.post("/adopt", async (c) => {
  const body = await c.req.json<{ userId?: string; loadId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  try {
    const adopted = await adoptPendingBooking(body.userId, body.loadId);
    return c.json({ ok: true, loadId: adopted });
  } catch {
    return c.json({ error: "NO_PENDING" }, 404);
  }
});

botDispatchRoutes.post("/dismiss-adoption", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await dismissPendingAdoption(body.userId);
  return c.json({ ok: true });
});

botDispatchRoutes.post("/pause", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const now = new Date().toISOString();
  const existing = await getDispatchState(body.userId);
  const state = existing ?? {
    userId: body.userId,
    paused: true,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  state.paused = true;
  state.updatedAt = now;
  await upsertDispatchState(state);

  return c.json({ ok: true, paused: true });
});

botDispatchRoutes.post("/resume", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const now = new Date().toISOString();
  const existing = await getDispatchState(body.userId);
  const state = existing ?? {
    userId: body.userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  state.paused = false;
  state.updatedAt = now;
  await upsertDispatchState(state);

  return c.json({ ok: true, paused: false });
});

botDispatchRoutes.post("/handoff/complete", async (c) => {
  const body = await c.req.json<{ userId?: string; readinessWindow?: string }>();
  if (!body.userId || !body.readinessWindow) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  try {
    const result = await completeHandoffReadiness(body.userId, body.readinessWindow);
    return c.json({ ok: true, ...result });
  } catch {
    return c.json({ error: "NO_HANDOFF" }, 404);
  }
});

botDispatchRoutes.post("/handoff/dismiss", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await dismissHandoff(body.userId);
  return c.json({ ok: true });
});

botDispatchRoutes.post("/handoff/draft", async (c) => {
  const body = await c.req.json<{
    userId?: string;
    origin?: string;
    destination?: string;
    minRate?: number;
    minPayout?: number;
  }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  try {
    const handoff = await updateHandoffDraft(body.userId, {
      origin: body.origin,
      destination: body.destination,
      minRate: body.minRate,
      minPayout: body.minPayout,
    });
    return c.json({ ok: true, handoff });
  } catch {
    return c.json({ error: "NO_HANDOFF" }, 404);
  }
});
