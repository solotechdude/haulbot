import { type Bot } from "grammy";
import { formatRouteLabel } from "@haulbot/shared";
import * as api from "../api";
import { formatReadiness, readinessFromPreset } from "../format";
import { requireLinkedCallbackUser } from "../linked-user";
import { parseHandoffCriteria } from "../parse-handoff-criteria";
import { parseReadinessText } from "../parse-readiness";
import { getSession } from "../session";

function formatDraftLine(handoff: {
  deliveryCity: string;
  draftNextLeg: {
    searchCriteria: { origin?: string; destination?: string; minRate?: number; minPayout?: number };
    hardRules: { minRate?: number; minPayout?: number };
  };
}): string {
  const o = handoff.draftNextLeg.searchCriteria.origin ?? handoff.deliveryCity;
  const d = handoff.draftNextLeg.searchCriteria.destination ?? o;
  const rate = handoff.draftNextLeg.hardRules.minRate;
  const payout = handoff.draftNextLeg.hardRules.minPayout;
  const rules =
    rate != null && payout != null ? ` ($${rate}/mi min, $${payout} min payout)` : "";
  return `${formatRouteLabel(o, d)}${rules}`;
}

async function confirmHandoffComplete(
  reply: (text: string) => Promise<unknown>,
  userId: string,
  readinessWindow: string,
): Promise<boolean> {
  try {
    const result = await api.completeHandoff(userId, readinessWindow);
    const leg = result.activeLeg;
    await reply(
      `Next leg queued: ${formatRouteLabel(leg.searchCriteria.origin ?? "?", leg.searchCriteria.destination ?? leg.searchCriteria.origin ?? "?")}\n` +
        `Hard rules: $${leg.hardRules.minRate}/mi min, $${leg.hardRules.minPayout} min payout\n` +
        `Pickup ready: ${formatReadiness(readinessWindow)}\n` +
        `Use /complete on your current trip when done — agent searches after that at pickup time.\n\n` +
        `If you reload the extension, send /campaign again and tap Book now to re-arm.`,
    );
    return true;
  } catch {
    await reply("Handoff expired. Use /campaign to set your next leg.");
    return false;
  }
}

export function registerHandoffHandlers(bot: Bot): void {
  bot.callbackQuery(/^handoff:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const { chatId, userId } = linked;

    const action = ctx.callbackQuery.data.replace("handoff:", "");

    if (action === "skip") {
      await api.dismissHandoff(userId);
      const session = getSession(chatId);
      delete session.step;
      await ctx.reply("Next leg not scheduled. Use /campaign when you're ready.");
      return;
    }

    if (action === "tune") {
      const { handoff } = await api.getDispatchStatus(userId);
      if (!handoff) {
        await ctx.reply("No pending handoff. Use /campaign after your trip.");
        return;
      }
      const session = getSession(chatId);
      session.userId = userId;
      session.step = "handoff_criteria_custom";
      await ctx.reply(
        `Edit next leg route/rules.\nCurrent: ${formatDraftLine(handoff)}\n\n` +
          "Reply with:\n" +
          "• DESTINATION (or anywhere)\n" +
          "• ORIGIN minRate minPayout\n" +
          "• ORIGIN minRate minPayout DESTINATION\n\n" +
          "Examples:\nanywhere\nBRAMPTON 3 200\nBRAMPTON 3 200 ATL",
      );
      return;
    }

    if (action === "custom") {
      const session = getSession(chatId);
      session.userId = userId;
      session.step = "handoff_readiness_custom";
      await ctx.reply(
        "When do you want your next load?\n\nExamples:\n• Jun 25 8am\n• tomorrow 6pm\n• +2 hours\n• now",
      );
      return;
    }

    const readinessWindow = readinessFromPreset(action);
    if (!readinessWindow) {
      await ctx.reply("Unknown option. Tap a button on the book message or use Custom time.");
      return;
    }

    const session = getSession(chatId);
    delete session.step;
    await confirmHandoffComplete((t) => ctx.reply(t), userId, readinessWindow);
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    if (!ctx.chat?.id) return await next();

    const session = getSession(ctx.chat.id);

    if (session.step === "handoff_criteria_custom" && session.userId) {
      const { handoff } = await api.getDispatchStatus(session.userId);
      if (!handoff) {
        delete session.step;
        await ctx.reply("Handoff expired. Use /campaign to set your next leg.");
        return;
      }

      const parsed = parseHandoffCriteria(
        ctx.message.text,
        handoff.draftNextLeg.searchCriteria.origin ?? handoff.deliveryCity,
      );
      if (!parsed) {
        await ctx.reply("Could not parse that. Try: anywhere, ATL, or BRAMPTON 3 200");
        return;
      }

      try {
        const result = await api.updateHandoffDraft(session.userId, parsed);
        delete session.step;
        await ctx.reply(
          `Next leg updated: ${formatDraftLine(result.handoff)}\n\n` +
            "Tap a pickup time on the book message (+1h, +3h, Custom time…).",
        );
      } catch {
        delete session.step;
        await ctx.reply("Handoff expired. Use /campaign to set your next leg.");
      }
      return;
    }

    if (session.step !== "handoff_readiness_custom" || !session.userId) {
      return await next();
    }

    const iso = parseReadinessText(ctx.message.text);
    if (!iso) {
      await ctx.reply("Could not parse that time. Try: Jun 25 8am, tomorrow 6pm, +2 hours, or now");
      return;
    }

    const userId = session.userId;
    delete session.step;
    await confirmHandoffComplete((t) => ctx.reply(t), userId, iso);
  });
}

export function handoffStatusLine(handoff: {
  deliveryCity: string;
  draftNextLeg: {
    searchCriteria: { origin?: string; destination?: string; minRate?: number; minPayout?: number };
    hardRules: { minRate?: number; minPayout?: number };
  };
} | null | undefined): string {
  if (!handoff) return "";
  return `\nPending handoff: ${formatDraftLine(handoff)} (edit via book message buttons)`;
}
