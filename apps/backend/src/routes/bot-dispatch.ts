import { Hono } from "hono";
import type { ActiveLeg } from "@haulbot/shared";
import { completeCommitment } from "../booking/complete-commitment";
import { adoptPendingBooking, dismissPendingAdoption } from "../booking/external-adoption";
import {
  completeHandoffReadiness,
  dismissHandoff,
  getPendingHandoff,
  updateHandoffDraft,
} from "../booking/handoff";
import { cancelHunt, shiftHuntPickup, shiftHuntPickupByHours } from "../booking/hunt";
import { getDispatchState, upsertDispatchState } from "../db";
import { armActiveLeg } from "../dispatch/arm-leg";
import { applyGoal } from "../goal/apply";
import { getDriverProfile } from "../onboarding";
import { requireServiceToken } from "../middleware/auth";

export const botDispatchRoutes = new Hono();

botDispatchRoutes.use("*", requireServiceToken());

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extension polls every ~5s, may navigate to the load board (~15s) before acking. */
const PROBE_WAIT_MS = 25_000;
const PROBE_POLL_MS = 1_000;

/**
 * Live status probe — the driver must never be shown stale state. Sets
 * statusProbe on dispatch_states; the extension picks it up on its next
 * poll, re-checks the load board for real (navigating there if needed),
 * and acks via heartbeat. Returns the post-check state.
 */
async function runStatusProbe(
  userId: string,
): Promise<{ live: "confirmed" | "unreachable"; state: Awaited<ReturnType<typeof getDispatchState>> }> {
  const existing = await getDispatchState(userId);
  if (!existing) return { live: "unreachable", state: existing };

  const requestedAt = new Date().toISOString();
  existing.statusProbe = { requestedAt };
  existing.updatedAt = requestedAt;
  await upsertDispatchState(existing);

  const deadline = Date.now() + PROBE_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(PROBE_POLL_MS);
    const current = await getDispatchState(userId);
    if (current?.statusProbeAckedAt && current.statusProbeAckedAt >= requestedAt) {
      return { live: "confirmed", state: current };
    }
  }

  return { live: "unreachable", state: await getDispatchState(userId) };
}

botDispatchRoutes.get("/status/:userId", async (c) => {
  const userId = c.req.param("userId");
  const profile = await getDriverProfile(userId);
  if (!profile) return c.json({ error: "NOT_FOUND" }, 404);

  let state = await getDispatchState(userId);
  let live: "confirmed" | "unreachable" | null = null;

  if (c.req.query("fresh") === "1") {
    const probe = await runStatusProbe(userId);
    live = probe.live;
    state = probe.state ?? state;
  }

  const handoff = await getPendingHandoff(userId);
  return c.json({
    profile,
    dispatch: state ?? { paused: false, activeLeg: null, commitment: null },
    handoff,
    live,
  });
});

botDispatchRoutes.post("/campaign", async (c) => {
  /** Telegram campaign wizard — see docs/campaign-bot-flow.md */
  const body = await c.req.json<{
    userId?: string;
    origin?: string;
    origins?: string[];
    destination?: string;
    minRate?: number;
    minPayout?: number;
    radius?: number;
    destinationRadius?: number;
    equipment?: import("@haulbot/shared").EquipmentSelection;
    workTypes?: string[];
    loadTypes?: string[];
    readinessWindow?: string;
    clearCommitment?: boolean;
  }>();

  const origins =
    body.origins?.length ?
      body.origins.map((o) => o.toUpperCase())
    : body.origin ?
      [body.origin.toUpperCase()]
    : null;

  if (!body.userId || !origins?.length || body.minRate == null || body.minPayout == null) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const origin = origins[0]!;
  const destination = (body.destination ?? origin).toUpperCase();
  const readinessWindow = body.readinessWindow ?? new Date().toISOString();

  const activeLeg: ActiveLeg = {
    mode: "campaign",
    searchCriteria: {
      origin,
      origins,
      destination,
      ...(body.radius != null ? { radius: body.radius } : {}),
      ...(body.destinationRadius != null ? { destinationRadius: body.destinationRadius } : {}),
      ...(body.equipment ? { equipment: body.equipment } : {}),
      ...(body.workTypes?.length ? { workTypes: body.workTypes } : {}),
      ...(body.loadTypes?.length ? { loadTypes: body.loadTypes } : {}),
      boardMinRate: body.minRate,
      boardMinPayout: body.minPayout,
    },
    hardRules: { minRate: body.minRate, minPayout: body.minPayout },
    bookPriority: "payout_then_rate",
    readinessWindow,
    searchOpensAt: readinessWindow,
  };

  const result = await armActiveLeg(body.userId, activeLeg, {
    clearCommitment: body.clearCommitment,
  });
  if (!result.ok) {
    return c.json({ error: result.error, commitment: result.commitment }, 409);
  }

  return c.json({ ok: true, activeLeg });
});

botDispatchRoutes.post("/campaign/preset", async (c) => {
  const body = await c.req.json<{
    userId?: string;
    name?: string;
    draft?: Record<string, unknown>;
  }>();
  if (!body.userId || !body.name?.trim() || !body.draft) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const state = await getDispatchState(body.userId);
  if (!state) return c.json({ error: "NOT_FOUND" }, 404);

  const presets = state.savedCampaignPresets ?? [];
  const entry = {
    name: body.name.trim().slice(0, 40),
    draft: body.draft as import("@haulbot/shared").SavedCampaignPreset["draft"],
    savedAt: new Date().toISOString(),
  };
  const idx = presets.findIndex((p) => p.name === entry.name);
  if (idx >= 0) presets[idx] = entry;
  else presets.unshift(entry);
  state.savedCampaignPresets = presets.slice(0, 10);
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);
  return c.json({ ok: true });
});

/** O3 — Telegram: /goal <natural language> */
botDispatchRoutes.post("/goal", async (c) => {
  const body = await c.req.json<{ userId?: string; text?: string; origin?: string }>();
  if (!body.userId || !body.text?.trim()) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }

  const result = await applyGoal(body.userId, body.text.trim(), body.origin);
  if (!result.ok) {
    if (result.error === "NEED_ORIGIN") {
      return c.json({ error: "NEED_ORIGIN", goal: result.goal }, 422);
    }
    return c.json({ error: result.error, commitment: result.commitment }, 409);
  }

  return c.json({ ok: true, activeLeg: result.activeLeg, goal: result.goal });
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

  return c.json({
    ok: true,
    clearedLoadId: result.clearedLoadId,
    promotedQueued: result.promotedQueued,
    offerRehunt: result.offerRehunt,
  });
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

async function setPaused(userId: string, paused: boolean): Promise<void> {
  const now = new Date().toISOString();
  const state = (await getDispatchState(userId)) ?? {
    userId,
    paused,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };

  state.paused = paused;
  state.updatedAt = now;
  await upsertDispatchState(state);

  const { syncDispatchDashboard } = await import("../telegram/dashboard-sync");
  await syncDispatchDashboard(userId, state);
}

botDispatchRoutes.post("/pause", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await setPaused(body.userId, true);
  return c.json({ ok: true, paused: true });
});

botDispatchRoutes.post("/resume", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  await setPaused(body.userId, false);
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

botDispatchRoutes.post("/hunt/shift", async (c) => {
  const body = await c.req.json<{ userId?: string; hours?: number; readinessWindow?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  try {
    if (body.readinessWindow) {
      const result = await shiftHuntPickup(body.userId, body.readinessWindow);
      return c.json({ ok: true, ...result });
    }
    const hours = body.hours ?? 1;
    const result = await shiftHuntPickupByHours(body.userId, hours);
    return c.json({ ok: true, ...result });
  } catch {
    return c.json({ error: "NOT_HUNTING" }, 404);
  }
});

botDispatchRoutes.post("/hunt/cancel", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  try {
    await cancelHunt(body.userId);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "NOT_HUNTING" }, 404);
  }
});

botDispatchRoutes.post("/rehunt", async (c) => {
  const body = await c.req.json<{ userId?: string; accept?: boolean }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const state = await getDispatchState(body.userId);
  if (!state) return c.json({ error: "NOT_FOUND" }, 404);

  if (!body.accept) {
    state.canceledHunt = null;
    state.uiRehuntOffer = false;
    state.updatedAt = new Date().toISOString();
    await upsertDispatchState(state);
    const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
    await ensureDispatchDashboardPin(body.userId);
    return c.json({ ok: true, armed: false });
  }

  const leg = state.canceledHunt;
  if (!leg) return c.json({ error: "NO_CANCELED_HUNT" }, 404);

  const readinessWindow = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const activeLeg = {
    ...leg,
    readinessWindow,
    searchOpensAt: readinessWindow,
  };
  state.activeLeg = activeLeg;
  state.canceledHunt = null;
  state.uiRehuntOffer = false;
  state.campaignSessionId = crypto.randomUUID();
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(body.userId);

  return c.json({ ok: true, armed: true, activeLeg, readinessWindow });
});

botDispatchRoutes.post("/sync-ui", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const { ensureDispatchDashboardPin } = await import("../telegram/dashboard-sync");
  await ensureDispatchDashboardPin(body.userId);
  return c.json({ ok: true });
});

botDispatchRoutes.post("/ui/complete-prompt", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const { setDashboardUiPrompt } = await import("../telegram/dashboard-sync");
  await setDashboardUiPrompt(body.userId, "complete");
  return c.json({ ok: true });
});

botDispatchRoutes.post("/ui/cancel-hunt-prompt", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const { setDashboardUiPrompt } = await import("../telegram/dashboard-sync");
  await setDashboardUiPrompt(body.userId, "cancel_hunt");
  return c.json({ ok: true });
});

botDispatchRoutes.post("/ui/clear-prompts", async (c) => {
  const body = await c.req.json<{ userId?: string }>();
  if (!body.userId) return c.json({ error: "INVALID_REQUEST" }, 400);

  const { clearDashboardUiPrompts } = await import("../telegram/dashboard-sync");
  await clearDashboardUiPrompts(body.userId);
  return c.json({ ok: true });
});
