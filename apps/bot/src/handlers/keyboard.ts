import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";
import {
  buildReplyKeyboardCells,
  COMPLETE_TRIP_LABEL,
  resolveReplyKeyboardState,
  START_SEARCH_LABEL,
} from "@haulbot/shared";
import * as api from "../api";
import { resolveLocationToMarketCity } from "../geocode";
import { startSearchMiniAppUrl } from "../mini-app-url";
import { formatReadiness } from "../format";
import { parseReadinessText } from "../parse-readiness";
import { requireLinkedCallbackUser, requireLinkedUser } from "../linked-user";
import { getSession } from "../session";
import { startCampaignWizard } from "./campaign-wizard";
import {
  editStatusMessage,
  fetchFullStatus,
  formatShortStatus,
  statusInlineKeyboard,
} from "./status-view";

function replyKeyboardCellToGrammy(cell: import("@haulbot/shared").ReplyKeyboardCell) {
  if (cell.type === "web_app") {
    return Keyboard.webApp(cell.label, cell.web_app.url);
  }
  return Keyboard.text(cell.label);
}

export function replyKeyboardFor(state: {
  hasCommitment: boolean;
  paused: boolean;
}): Keyboard {
  const rows = buildReplyKeyboardCells(state, startSearchMiniAppUrl());
  const kb = new Keyboard();
  for (const row of rows) {
    kb.row(...row.map(replyKeyboardCellToGrammy));
  }
  return kb.resized().persistent();
}

export async function replyKeyboardForUser(userId: string): Promise<Keyboard> {
  const { dispatch } = await api.getDispatchStatus(userId);
  return replyKeyboardFor(resolveReplyKeyboardState(dispatch));
}

function completeToast(
  result: { clearedLoadId: string; promotedQueued: boolean },
  dispatch: api.DispatchStatus["dispatch"],
): string {
  if (result.promotedQueued && dispatch.commitment) {
    return `${result.clearedLoadId} done — ${dispatch.commitment.loadId} is now current`;
  }
  return `Trip ${result.clearedLoadId} complete`;
}

async function tryDeleteUserMessage(ctx: {
  chat?: { id: number };
  message?: { message_id: number };
  api: { deleteMessage: (chatId: number, messageId: number) => Promise<unknown> };
}): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId || !ctx.message) return;
  try {
    await ctx.api.deleteMessage(chatId, ctx.message.message_id);
  } catch {
    // ignore
  }
}

const KEYBOARD_LABELS = new Set([
  COMPLETE_TRIP_LABEL,
  START_SEARCH_LABEL,
  "Status",
  "Pause",
  "Resume",
]);

export function registerHuntHandlers(bot: Bot): void {
  bot.callbackQuery(/^hunt:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const { userId } = linked;
    const action = ctx.callbackQuery.data.replace("hunt:", "");

    if (action === "cancel") {
      await ctx.answerCallbackQuery();
      await api.promptCancelHunt(userId);
      return;
    }

    if (action === "cancel:yes") {
      try {
        await api.cancelHunt(userId);
        await api.clearDashboardPrompts(userId);
        await ctx.answerCallbackQuery({ text: "Hunt canceled" });
        void api.syncDispatchUi(userId);
      } catch {
        await ctx.answerCallbackQuery({ text: "No active hunt" });
      }
      return;
    }

    if (action === "cancel:no") {
      await api.clearDashboardPrompts(userId);
      await ctx.answerCallbackQuery({ text: "Still searching" });
      return;
    }

    if (action === "late:custom") {
      await ctx.answerCallbackQuery();
      const session = getSession(ctx.chat!.id);
      session.userId = userId;
      session.step = "hunt_readiness_custom";
      return;
    }

    if (action === "late:+1h") {
      try {
        const result = await api.shiftHuntPickup(userId, 1);
        await ctx.answerCallbackQuery({
          text: `Pickup ${formatReadiness(result.readinessWindow)}`,
        });
        void api.syncDispatchUi(userId);
      } catch {
        await ctx.answerCallbackQuery({ text: "No active hunt" });
      }
      return;
    }

    if (action === "late:+2h") {
      try {
        const result = await api.shiftHuntPickup(userId, 2);
        await ctx.answerCallbackQuery({
          text: `Pickup ${formatReadiness(result.readinessWindow)}`,
        });
        void api.syncDispatchUi(userId);
      } catch {
        await ctx.answerCallbackQuery({ text: "No active hunt" });
      }
      return;
    }
  });

  bot.callbackQuery(/^rehunt:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const accept = ctx.callbackQuery.data === "rehunt:yes";
    try {
      const result = await api.rehunt(linked.userId, accept);
      if (accept && result.armed) {
        await ctx.answerCallbackQuery({
          text: `Hunt started — pickup ${formatReadiness(result.readinessWindow!)}`,
        });
      } else {
        await ctx.answerCallbackQuery({ text: "OK" });
      }
      void api.syncDispatchUi(linked.userId);
    } catch {
      await ctx.answerCallbackQuery({ text: "Could not start hunt" });
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    const session = getSession(ctx.chat!.id);
    const text = ctx.message.text.trim();

    if (session.step === "hunt_readiness_custom" && session.userId) {
      const iso = parseReadinessText(text);
      if (!iso) {
        await ctx.reply("Could not parse. Try: +30m, +1h, 2pm, tomorrow 8am");
        return;
      }
      const userId = session.userId;
      delete session.step;
      try {
        await api.shiftHuntPickupTo(userId, iso);
        await tryDeleteUserMessage(ctx);
        void api.syncDispatchUi(userId);
      } catch {
        await ctx.reply("No active hunt to update.");
      }
      return;
    }

    return await next();
  });
}

export async function syncUiForUser(userId: string): Promise<void> {
  await api.syncDispatchUi(userId);
}

function welcomeBackMessage(dispatch: api.DispatchStatus["dispatch"]): string {
  if (dispatch.commitment || dispatch.activeLeg || dispatch.queuedCommitment) {
    return "Welcome back — your dispatch status is pinned above.";
  }
  return "Welcome back. Tap Start search to set origin, radius, equipment, and book mins.";
}

export async function welcomeLinkedUser(
  ctx: { reply: (text: string, extra?: { reply_markup: Keyboard }) => Promise<unknown> },
  userId: string,
  options: { firstConnect?: boolean } = {},
): Promise<void> {
  const fallbackText = options.firstConnect
    ? "Telegram connected. Tap Start search to set up your first campaign."
    : "Welcome back. Tap Start search to set origin, radius, equipment, and book mins.";

  try {
    await api.syncDispatchUi(userId);
    const { dispatch } = await api.getDispatchStatus(userId);
    const text = options.firstConnect ? fallbackText : welcomeBackMessage(dispatch);
    const kb = await replyKeyboardForUser(userId);
    await ctx.reply(text, { reply_markup: kb });
  } catch {
    await ctx.reply(fallbackText, {
      reply_markup: replyKeyboardFor({ hasCommitment: false, paused: false }),
    });
  }
}

export async function showReplyKeyboard(
  ctx: { reply: (text: string, extra?: { reply_markup: Keyboard }) => Promise<unknown> },
  userId: string,
): Promise<void> {
  await welcomeLinkedUser(ctx, userId);
}

export function registerKeyboardHandlers(bot: Bot): void {
  bot.on("message:web_app_data", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) return;

    const session = getSession(ctx.chat!.id);
    if (session.step) {
      await ctx.reply("Finish the step above first.");
      return;
    }

    let payload: { lat?: number; lon?: number; error?: string };
    try {
      payload = JSON.parse(ctx.message.web_app_data.data) as typeof payload;
    } catch {
      payload = { error: "invalid" };
    }

    const { dispatch } = await api.getDispatchStatus(userId);
    const defaults = dispatch.lastCampaignDefaults ?? null;

    if (payload.error || payload.lat == null || payload.lon == null) {
      await startCampaignWizard(ctx, userId, { defaults, locationFailed: true });
      return;
    }

    const city = await resolveLocationToMarketCity(payload.lat, payload.lon);
    await startCampaignWizard(ctx, userId, {
      defaults,
      detectedOriginToken: city !== "UNKNOWN" ? city : undefined,
      locationFailed: city === "UNKNOWN",
    });
  });

  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return await next();

    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) return await next();

    const session = getSession(ctx.chat!.id);
    if (session.step) {
      if (KEYBOARD_LABELS.has(text)) {
        await ctx.reply("Finish the step above first.");
        await tryDeleteUserMessage(ctx);
        return;
      }
      return await next();
    }

    if (text === COMPLETE_TRIP_LABEL) {
      const { dispatch } = await api.getDispatchStatus(userId);
      if (!dispatch.commitment) {
        void api.syncDispatchUi(userId);
        await tryDeleteUserMessage(ctx);
        return;
      }
      await api.promptCompleteConfirm(userId);
      await tryDeleteUserMessage(ctx);
      return;
    }

    if (text === START_SEARCH_LABEL) {
      const { dispatch } = await api.getDispatchStatus(userId);
      await startCampaignWizard(ctx, userId, {
        defaults: dispatch.lastCampaignDefaults ?? null,
        locationFailed: true,
      });
      await tryDeleteUserMessage(ctx);
      return;
    }

    if (text === "Status") {
      await api.syncDispatchUi(userId);
      const status = await api.getDispatchStatus(userId);
      await tryDeleteUserMessage(ctx);
      await ctx.reply(formatShortStatus(status));
      return;
    }

    if (text === "Pause") {
      await api.setPaused(userId, true);
      void api.syncDispatchUi(userId);
      await tryDeleteUserMessage(ctx);
      return;
    }

    if (text === "Resume") {
      await api.setPaused(userId, false);
      void api.syncDispatchUi(userId);
      await tryDeleteUserMessage(ctx);
      return;
    }

    return await next();
  });

  bot.callbackQuery(/^complete:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;

    if (ctx.callbackQuery.data === "complete:no") {
      await api.clearDashboardPrompts(linked.userId);
      await ctx.answerCallbackQuery({ text: "OK" });
      void api.syncDispatchUi(linked.userId);
      return;
    }

    if (ctx.callbackQuery.data === "complete:prompt") {
      try {
        const { dispatch } = await api.getDispatchStatus(linked.userId);
        if (!dispatch.commitment) {
          await ctx.answerCallbackQuery({ text: "No active trip" });
          return;
        }
        await api.promptCompleteConfirm(linked.userId);
        await ctx.answerCallbackQuery();
      } catch {
        await ctx.answerCallbackQuery({ text: "Could not prompt" });
      }
      return;
    }

    try {
      const result = await api.completeCommitment(linked.userId);
      const { dispatch } = await api.getDispatchStatus(linked.userId);
      await ctx.answerCallbackQuery({ text: completeToast(result, dispatch) });
      void api.syncDispatchUi(linked.userId);
    } catch {
      await ctx.answerCallbackQuery({ text: "Could not complete trip" });
    }
  });

  bot.callbackQuery(/^dispatch:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;

    const action = ctx.callbackQuery.data.replace("dispatch:", "");
    try {
      if (action === "pause") {
        await api.setPaused(linked.userId, true);
        await ctx.answerCallbackQuery({ text: "Paused" });
      } else if (action === "resume") {
        await api.setPaused(linked.userId, false);
        await ctx.answerCallbackQuery({ text: "Resumed" });
      } else {
        await ctx.answerCallbackQuery({ text: "Unknown action" });
        return;
      }
      void api.syncDispatchUi(linked.userId);
    } catch {
      await ctx.answerCallbackQuery({ text: "Could not update pause state" });
    }
  });

  bot.callbackQuery("status:refresh", async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;

    void api.syncDispatchUi(linked.userId);

    let status: api.DispatchStatus;
    try {
      status = await api.getDispatchStatus(linked.userId);
    } catch {
      await ctx.answerCallbackQuery({ text: "Could not load status" });
      return;
    }

    const result = await editStatusMessage(ctx, formatShortStatus(status));
    await ctx.answerCallbackQuery(
      result === "unchanged" ? { text: "Up to date" } : undefined,
    );
  });

  bot.callbackQuery("status:details", async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;

    const needsProbe = await api.getDispatchStatus(linked.userId).then(
      (s) => Boolean(s.dispatch.activeLeg || s.dispatch.campaignSessionId),
      () => false,
    );

    if (needsProbe) {
      await editStatusMessage(ctx, "Checking agent live…");
    }

    const text = await fetchFullStatus(linked.userId);
    await editStatusMessage(ctx, text);
    await ctx.answerCallbackQuery();
  });
}
