import { InlineKeyboard, type Bot } from "grammy";
import { formatRouteLabel, resolveReplyKeyboardState } from "@haulbot/shared";
import * as api from "../api";
import { formatReadiness } from "../format";
import { requireLinkedCallbackUser, requireLinkedUser } from "../linked-user";
import { getSession } from "../session";
import { replyKeyboardFor, replyKeyboardForUser } from "./keyboard";
import { startCampaignWizard } from "./campaign-wizard";
import { replyWithFreshFullStatus } from "./status-view";

export function registerDispatchHandlers(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Haulbot commands:\n\n" +
        "/goal <objective> — e.g. /goal $8k this week, Atlanta by Thursday\n" +
        "/campaign ORIGIN minRate minPayout — search & book (defaults to anywhere)\n" +
        "/complete [tripId] — mark current trip done\n" +
        "/status — dispatch state\n" +
        "/pause /resume — stop or resume agent\n" +
        "/connect_relay — link Amazon Relay credentials",
    );
  });

  bot.command("complete", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    const loadId = ctx.match?.trim() || undefined;
    try {
      const clearedLoadId = await api.completeCommitment(userId, loadId || undefined);
      void api.syncDispatchUi(userId);
      const { dispatch } = await api.getDispatchStatus(userId);
      const kb = replyKeyboardFor(resolveReplyKeyboardState(dispatch));
      const text = dispatch.commitment
        ? `Trip ${clearedLoadId} complete. ${dispatch.commitment.loadId} is now your current trip.`
        : `Trip ${clearedLoadId} complete.`;
      await ctx.reply(text, { reply_markup: kb });
    } catch {
      await ctx.reply("No active trip to complete.");
    }
  });

  bot.command("goal", async (ctx) => {
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply(
        "Tell me your objective in plain words.\n\n" +
          "Examples:\n" +
          "/goal $8k this week\n" +
          "/goal $5k from DFW, Atlanta by Thursday",
      );
      return;
    }

    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    await submitGoal(ctx.chat!.id, (t) => ctx.reply(t), userId, text);
  });

  async function submitGoal(
    chatId: number,
    reply: (text: string) => Promise<unknown>,
    userId: string,
    text: string,
    origin?: string,
  ): Promise<void> {
    try {
      const result = await api.setGoal(userId, text, origin);
      const session = getSession(chatId);
      delete session.step;
      delete session.goalText;

      const leg = result.activeLeg;
      const routeLine = formatRouteLabel(
        String(leg.searchCriteria.origin ?? "?"),
        String(leg.searchCriteria.destination ?? leg.searchCriteria.origin ?? "?"),
      );
      const target = result.goal.revenueTarget
        ? `Target: $${result.goal.revenueTarget.toLocaleString("en-US")}${
            result.goal.deadline ? ` by ${formatReadiness(result.goal.deadline)}` : ""
          }\n`
        : "";
      await reply(
        `Goal set.\n${target}Searching: ${routeLine}\n` +
          `The agent books loads that keep you on pace. /status for details, /pause to stop.`,
      );
    } catch (err) {
      const message = (err as Error).message;
      if (message === "NEED_ORIGIN") {
        const session = getSession(chatId);
        session.userId = userId;
        session.goalText = text;
        session.step = "goal_origin";
        await reply("Where are you starting from? Reply with a city (e.g. DFW).");
        return;
      }
      if (message.startsWith("COMMITMENT_ACTIVE:")) {
        const loadId = message.split(":")[1];
        await reply(
          `You have an active trip (${loadId}). Send /complete when it's done, then set your goal again.`,
        );
        return;
      }
      await reply("Could not set that goal. Try again or use /campaign.");
    }
  }

  bot.command("campaign", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/) ?? [];
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    if (parts.length < 3) {
      await startCampaignWizard(ctx, userId, {});
      return;
    }

    const origin = parts[0]!.toUpperCase();
    const minRate = Number(parts[1]);
    const minPayout = Number(parts[2]);

    if (!Number.isFinite(minRate) || minRate <= 0) {
      await ctx.reply("minRate must be a positive number (e.g. 3 for $3/mi).");
      return;
    }
    if (!Number.isFinite(minPayout) || minPayout <= 0) {
      await ctx.reply("minPayout must be a positive number (e.g. 200).");
      return;
    }

    const { dispatch } = await api.getDispatchStatus(userId);
    await startCampaignWizard(ctx, userId, {
      prefill: {
        origins: [origin],
        destination: origin,
        minRate,
        minPayout,
      },
      startStep: "radius",
      defaults: dispatch.lastCampaignDefaults ?? null,
    });
  });

  bot.callbackQuery(/^adopt:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const { userId } = linked;

    const action = ctx.callbackQuery.data.replace("adopt:", "");
    if (action === "dismiss") {
      await api.dismissPendingAdoption(userId);
      const kb = await replyKeyboardForUser(userId);
      await ctx.reply("Ignored — not tracking that Relay booking.", { reply_markup: kb });
      return;
    }

    try {
      const loadId = await api.adoptPendingBooking(userId, action);
      const kb = await replyKeyboardForUser(userId);
      await ctx.reply(`Tracking trip ${loadId}. Use /complete when finished.`, { reply_markup: kb });
    } catch {
      const kb = await replyKeyboardForUser(userId);
      await ctx.reply("Could not adopt that booking. Try /status.", { reply_markup: kb });
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    if (!ctx.chat?.id) return await next();

    const session = getSession(ctx.chat.id);
    const text = ctx.message.text.trim();

    if (session.step === "goal_origin" && session.userId && session.goalText) {
      await submitGoal(ctx.chat.id, (t) => ctx.reply(t), session.userId, session.goalText, text);
      return;
    }

    return await next();
  });

  bot.command("status", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    await replyWithFreshFullStatus(userId, (t) => ctx.reply(t));
  });

  bot.command("pause", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    try {
      await api.setPaused(userId, true);
      await ctx.reply("Dispatch paused.");
    } catch {
      await ctx.reply("Could not pause.");
    }
  });

  bot.command("resume", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    try {
      await api.setPaused(userId, false);
      await ctx.reply("Dispatch resumed.");
    } catch {
      await ctx.reply("Could not resume.");
    }
  });
}
