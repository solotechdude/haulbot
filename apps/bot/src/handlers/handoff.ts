import { type Bot, type Context } from "grammy";
import { formatRouteLabel } from "@haulbot/shared";
import * as api from "../api";
import { formatReadiness, readinessFromPreset } from "../format";
import { requireLinkedCallbackUser } from "../linked-user";
import { parseHandoffCriteria } from "../parse-handoff-criteria";
import { parseReadinessText } from "../parse-readiness";
import { getSession, type CampaignDraft } from "../session";
import { startCampaignWizard } from "./campaign-wizard";
import type { EquipmentMain } from "@haulbot/shared";

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

async function tryDeleteUserMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId || !ctx.message) return;
  try {
    await ctx.api.deleteMessage(chatId, ctx.message.message_id);
  } catch {
    // ignore
  }
}

async function armOrShiftHandoff(
  ctx: Context,
  userId: string,
  readinessWindow: string,
): Promise<boolean> {
  const { dispatch, handoff } = await api.getDispatchStatus(userId);

  if (handoff) {
    try {
      await api.completeHandoff(userId, readinessWindow);
      await ctx.answerCallbackQuery({
        text: `Searching — pickup ${formatReadiness(readinessWindow)}`,
      });
      void api.syncDispatchUi(userId);
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("NEXT_LEG_FULL")) {
        await ctx.answerCallbackQuery({ text: "Next leg already booked" });
      } else {
        await ctx.answerCallbackQuery({ text: "Handoff expired" });
      }
      void api.syncDispatchUi(userId);
      return false;
    }
  }

  if (dispatch.activeLeg) {
    try {
      const result = await api.shiftHuntPickupTo(userId, readinessWindow);
      await ctx.answerCallbackQuery({
        text: `Pickup ${formatReadiness(result.readinessWindow)}`,
      });
      void api.syncDispatchUi(userId);
      return true;
    } catch {
      await ctx.answerCallbackQuery({ text: "No active hunt" });
      return false;
    }
  }

  await ctx.answerCallbackQuery({ text: "No pending handoff" });
  return false;
}

export function registerHandoffHandlers(bot: Bot): void {
  bot.callbackQuery(/^handoff:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const { chatId, userId } = linked;

    const action = ctx.callbackQuery.data.replace("handoff:", "");

    if (action === "skip") {
      const { dispatch } = await api.getDispatchStatus(userId);
      if (dispatch.activeLeg) {
        await ctx.answerCallbackQuery();
        await api.promptCancelHunt(userId);
        return;
      }
      await api.dismissHandoff(userId);
      await ctx.answerCallbackQuery({ text: "Next leg canceled" });
      void api.syncDispatchUi(userId);
      return;
    }

    if (action === "skip:yes") {
      try {
        await api.cancelHunt(userId);
      } catch {
        await api.dismissHandoff(userId);
      }
      await api.clearDashboardPrompts(userId);
      await ctx.answerCallbackQuery({ text: "Canceled" });
      void api.syncDispatchUi(userId);
      return;
    }

    if (action === "skip:no") {
      await ctx.answerCallbackQuery({ text: "OK" });
      return;
    }

    if (action === "wizard") {
      await ctx.answerCallbackQuery();
      const { handoff, dispatch } = await api.getDispatchStatus(userId);
      const leg = dispatch.activeLeg;
      const sc = handoff?.draftNextLeg.searchCriteria ?? leg?.searchCriteria;
      const hr = handoff?.draftNextLeg.hardRules ?? leg?.hardRules;
      if (!sc || !hr?.minRate || !hr?.minPayout) {
        await ctx.answerCallbackQuery({ text: "Use Start search" });
        return;
      }
      const origin = sc.origin ?? handoff?.deliveryCity ?? "";
      const prefill: Partial<CampaignDraft> = {
        origins: sc.origins?.length ? [...sc.origins] : origin ? [origin] : [],
        destination: sc.destination ?? origin,
        minRate: hr.minRate,
        minPayout: hr.minPayout,
        radius: sc.radius,
        destinationRadius: sc.destinationRadius,
        equipment: sc.equipment
          ? { main: sc.equipment.main as EquipmentMain, subs: [...sc.equipment.subs] }
          : undefined,
        workTypes: sc.workTypes,
        loadTypes: sc.loadTypes,
      };
      await startCampaignWizard(ctx, userId, {
        prefill,
        startStep: "review",
        defaults: dispatch.lastCampaignDefaults ?? null,
      });
      return;
    }

    if (action === "tune") {
      const { handoff } = await api.getDispatchStatus(userId);
      if (!handoff) {
        await ctx.answerCallbackQuery({ text: "Cancel hunt first to reconfigure" });
        return;
      }
      const session = getSession(chatId);
      session.userId = userId;
      session.step = "handoff_criteria_custom";
      await ctx.answerCallbackQuery({ text: "Reply with route/rules" });
      return;
    }

    if (action === "custom") {
      const session = getSession(chatId);
      session.userId = userId;
      session.step = "handoff_readiness_custom";
      await ctx.answerCallbackQuery({ text: "Reply with pickup time" });
      return;
    }

    const readinessWindow = readinessFromPreset(action);
    if (!readinessWindow) {
      await ctx.answerCallbackQuery({ text: "Unknown option" });
      return;
    }

    const session = getSession(chatId);
    delete session.step;
    await armOrShiftHandoff(ctx, userId, readinessWindow);
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    if (!ctx.chat?.id) return await next();

    const session = getSession(ctx.chat.id);

    if (session.step === "handoff_criteria_custom" && session.userId) {
      const { handoff } = await api.getDispatchStatus(session.userId);
      if (!handoff) {
        delete session.step;
        await ctx.reply("Handoff expired. Use Start search.");
        return;
      }

      const parsed = parseHandoffCriteria(
        ctx.message.text,
        handoff.draftNextLeg.searchCriteria.origin ?? handoff.deliveryCity,
      );
      if (!parsed) {
        await ctx.reply("Try: anywhere, ATL, or BRAMPTON 3 200");
        return;
      }

      try {
        await api.updateHandoffDraft(session.userId, parsed);
        delete session.step;
        await tryDeleteUserMessage(ctx);
        void api.syncDispatchUi(session.userId);
      } catch {
        delete session.step;
        await ctx.reply("Handoff expired. Use Start search.");
      }
      return;
    }

    if (session.step !== "handoff_readiness_custom" || !session.userId) {
      return await next();
    }

    const iso = parseReadinessText(ctx.message.text);
    if (!iso) {
      await ctx.reply("Try: Jun 25 8am, tomorrow 6pm, +2 hours, or now");
      return;
    }

    const userId = session.userId;
    delete session.step;
    await tryDeleteUserMessage(ctx);
    await armOrShiftHandoff(ctx, userId, iso);
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
  return `\nPending handoff: ${formatDraftLine(handoff)}`;
}
