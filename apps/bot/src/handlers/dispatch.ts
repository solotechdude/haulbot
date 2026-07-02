import { InlineKeyboard, type Bot } from "grammy";
import { formatCampaignStatusMessage } from "@relaybooking/shared";
import * as api from "../api";
import { parseReadinessText } from "../parse-readiness";
import { handoffStatusLine } from "./handoff";
import { clearCampaignSession, getSession, type CampaignDraft } from "../session";

async function requireLinkedUser(chatId: number | undefined): Promise<string | null> {
  if (!chatId) return null;
  try {
    return await api.getUserIdByChat(String(chatId));
  } catch {
    return null;
  }
}

function formatReadiness(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function activateCampaign(
  chatId: number,
  reply: (text: string, extra?: { reply_markup?: InlineKeyboard }) => Promise<{ message_id: number }>,
  userId: string,
  draft: CampaignDraft,
  readinessWindow: string,
  clearCommitment: boolean,
): Promise<void> {
  const result = await api.setCampaign(userId, {
    origin: draft.origin,
    destination: draft.destination,
    minRate: draft.minRate,
    minPayout: draft.minPayout,
    radius: draft.radius,
    readinessWindow,
    clearCommitment,
  });
  const leg = result.activeLeg;
  clearCampaignSession(chatId);
  const origin = String(leg.searchCriteria.origin ?? "?");
  const destination = String(leg.searchCriteria.destination ?? "?");

  const statusText = formatCampaignStatusMessage({
    origin,
    destination,
    armed: true,
    readinessWindow,
    agentStatus: {
      relayWorkState: new Date(readinessWindow).getTime() > Date.now() ? "deferred" : "idle",
      armed: true,
      updatedAt: new Date().toISOString(),
    },
  });
  const statusKeyboard = new InlineKeyboard().text("Details", "status:details");
  const pin = await reply(statusText, { reply_markup: statusKeyboard });
  await api.setCampaignStatusPin(userId, String(chatId), pin.message_id);

  await reply(
    `Armed: ${formatRoute(origin, destination)}\n` +
      `Book mins: $${leg.hardRules.minRate}/mi · $${leg.hardRules.minPayout} min payout\n` +
      `Pickup: ${formatReadiness(readinessWindow)}\n` +
      `Status updates in the pinned message above.`,
  );
}

function formatRoute(origin: string, destination: string): string {
  if (destination.trim().toUpperCase() === origin.trim().toUpperCase()) {
    return `${origin} → anywhere`;
  }
  return `${origin} → ${destination}`;
}

function moreFiltersKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Add more filters", "campaign:more_filters")
    .row()
    .text("Continue", "campaign:continue_review")
    .row()
    .text("Cancel", "campaign:cancel");
}

function filtersMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Destination", "campaign:filter:destination")
    .text("Radius", "campaign:filter:radius")
    .row()
    .text("Done — review", "campaign:continue_review")
    .row()
    .text("Cancel", "campaign:cancel");
}

function formatMustHaves(draft: CampaignDraft): string {
  const radius = draft.radius ?? 50;
  return (
    `Route: ${formatRoute(draft.origin, draft.destination)}\n` +
    `Book mins: $${draft.minRate}/mi · $${draft.minPayout} min payout\n` +
    `Radius: ${radius}mi\n` +
    `Equipment: Tractor + trailer (default)`
  );
}

function reviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Start searching", "campaign:start")
    .row()
    .text("Edit filters", "campaign:more_filters")
    .row()
    .text("Save preset", "campaign:save_preset")
    .row()
    .text("Cancel", "campaign:cancel");
}

function formatCampaignReview(draft: CampaignDraft): string {
  return (
    `Review search\n\n` +
    `${formatMustHaves(draft)}\n\n` +
    `Tap Start searching when this looks right.`
  );
}

function timingKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Book now", "campaign:now")
    .text("Schedule for later", "campaign:future")
    .row()
    .text("Cancel", "campaign:cancel");
}

function confirmCompleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Yes — trip is done", "campaign:complete_yes")
    .row()
    .text("Cancel", "campaign:cancel");
}

function readinessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("+1 hour", "campaign:ready:+1h")
    .text("+3 hours", "campaign:ready:+3h")
    .row()
    .text("Tomorrow 8am", "campaign:ready:tomorrow8")
    .row()
    .text("Custom time…", "campaign:ready:custom")
    .row()
    .text("Cancel", "campaign:cancel");
}

function readinessFromPreset(preset: string): string {
  const d = new Date();
  if (preset === "+1h") {
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }
  if (preset === "+3h") {
    d.setHours(d.getHours() + 3);
    return d.toISOString();
  }
  if (preset === "tomorrow8") {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }
  return d.toISOString();
}

export function registerDispatchHandlers(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "RelayBooking SOLO commands:\n\n" +
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
      const cleared = await api.completeCommitment(userId, loadId || undefined);
      const { dispatch } = await api.getDispatchStatus(userId);
      const leg = dispatch.activeLeg;
      const readyAt = leg?.readinessWindow ? new Date(leg.readinessWindow).getTime() : null;
      const queuedFuture = readyAt != null && readyAt > Date.now();

      if (leg && queuedFuture) {
        const origin = String(leg.searchCriteria?.origin ?? "?");
        const destination = String(leg.searchCriteria?.destination ?? "?");
        await ctx.reply(
          `Trip ${cleared} marked complete.\n\n` +
            `Queued leg active: ${formatRoute(origin, destination)}\n` +
            `Pickup ready: ${formatReadiness(leg.readinessWindow!)}\n` +
            `Extension will apply Relay filters ~2 min before pickup, then search and book.`,
        );
      } else if (leg && dispatch.campaignSessionId) {
        const origin = String(leg.searchCriteria?.origin ?? "?");
        const destination = String(leg.searchCriteria?.destination ?? "?");
        await ctx.reply(
          `Trip ${cleared} marked complete.\n\n` +
            `Queued leg armed: ${formatRoute(origin, destination)} — extension is searching Relay.`,
        );
      } else {
        await ctx.reply(`Trip ${cleared} marked complete. You can start a new campaign.`);
      }
    } catch {
      await ctx.reply("No active trip to complete. Use /status to check.");
    }
  });

  bot.command("campaign", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/) ?? [];
    if (parts.length < 3) {
      await ctx.reply(
        "Usage: /campaign ORIGIN minRate minPayout\n" +
          "Example: /campaign BRAMPTON 3 200\n\n" +
          "Origin + book mins are required. Destination defaults to anywhere — you can add filters next.",
      );
      return;
    }

    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
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

    const session = getSession(ctx.chat!.id);
    session.userId = userId;
    session.campaignDraft = {
      origin,
      destination: origin,
      minRate,
      minPayout,
    };
    session.step = "campaign_more_filters";

    await ctx.reply(
      `Campaign must-haves set:\n\n${formatMustHaves(session.campaignDraft)}\n\nAdd more Relay filters (destination, radius, etc.)?`,
      { reply_markup: moreFiltersKeyboard() },
    );
  });

  bot.callbackQuery(/^campaign:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const session = getSession(chatId);
    const userId = session.userId ?? (await requireLinkedUser(chatId));
    const draft = session.campaignDraft;
    if (!userId || !draft) {
      await ctx.reply("Session expired. Send /campaign again.");
      return;
    }

    const action = ctx.callbackQuery.data.replace("campaign:", "");

    if (action === "cancel") {
      clearCampaignSession(chatId);
      await ctx.reply("Campaign cancelled.");
      return;
    }

    if (action === "more_filters") {
      session.step = "campaign_more_filters";
      await ctx.reply("Optional filters:", { reply_markup: filtersMenuKeyboard() });
      return;
    }

    if (action === "continue_review") {
      session.step = "campaign_review";
      await ctx.reply(formatCampaignReview(draft), { reply_markup: reviewKeyboard() });
      return;
    }

    if (action === "filter:destination") {
      session.step = "campaign_filter_destination";
      await ctx.reply(
        `Current: ${formatRoute(draft.origin, draft.destination)}\n\n` +
          "Reply with a destination city code (e.g. ATL), or send anywhere to search all destinations.",
        { reply_markup: filtersMenuKeyboard() },
      );
      return;
    }

    if (action === "filter:radius") {
      session.step = "campaign_filter_radius";
      await ctx.reply(
        `Current radius: ${draft.radius ?? 50}mi\n\nReply with search radius in miles (e.g. 50, 100).`,
        { reply_markup: filtersMenuKeyboard() },
      );
      return;
    }

    if (action === "start") {
      session.step = "campaign_timing";
      await ctx.reply(
        `When do you need this load?`,
        { reply_markup: timingKeyboard() },
      );
      return;
    }

    if (action === "save_preset") {
      await ctx.reply(
        "Save preset is coming soon — pinned presets and history will land in P2.",
        { reply_markup: reviewKeyboard() },
      );
      return;
    }

    if (action === "now") {
      const { dispatch } = await api.getDispatchStatus(userId);
      if (dispatch.commitment) {
        session.step = "campaign_confirm_complete";
        await ctx.reply(
          `You have an active trip: ${dispatch.commitment.loadId}\n` +
            `(${dispatch.commitment.origin ?? "?"} → ${dispatch.commitment.destination ?? "?"})\n\n` +
            `Mark it complete before searching for a new load?`,
          { reply_markup: confirmCompleteKeyboard() },
        );
        return;
      }

      await activateCampaign(chatId, (t, extra) => ctx.reply(t, extra), userId, draft, new Date().toISOString(), false);
      return;
    }

    if (action === "future") {
      session.step = "campaign_readiness";
      await ctx.reply("When will you be ready to pick up?", { reply_markup: readinessKeyboard() });
      return;
    }

    if (action === "complete_yes") {
      try {
        await api.completeCommitment(userId);
      } catch {
        await ctx.reply("Could not clear trip. Try /complete.");
        return;
      }
      await activateCampaign(chatId, (t, extra) => ctx.reply(t, extra), userId, draft, new Date().toISOString(), true);
      return;
    }

    if (action.startsWith("ready:")) {
      const preset = action.replace("ready:", "");
      if (preset === "custom") {
        session.step = "campaign_readiness_custom";
        await ctx.reply(
          "When will you be ready to pick up?\n\nExamples:\n• Jun 25 8am\n• tomorrow 6pm\n• +2 hours\n• now",
        );
        return;
      }
      const readinessWindow = readinessFromPreset(preset);
      await activateCampaign(chatId, (t, extra) => ctx.reply(t, extra), userId, draft, readinessWindow, false);
    }
  });

  bot.callbackQuery(/^adopt:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userId = await requireLinkedUser(chatId);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    const action = ctx.callbackQuery.data.replace("adopt:", "");
    if (action === "dismiss") {
      await api.dismissPendingAdoption(userId);
      await ctx.reply("Ignored — not tracking that Relay booking.");
      return;
    }

    try {
      const loadId = await api.adoptPendingBooking(userId, action);
      await ctx.reply(`Tracking trip ${loadId}. Use /complete when finished.`);
    } catch {
      await ctx.reply("Could not adopt that booking. Try /status.");
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    if (!ctx.chat?.id) return await next();

    const session = getSession(ctx.chat.id);
    const draft = session.campaignDraft;
    const text = ctx.message.text.trim();

    if (session.step === "campaign_filter_destination" && session.userId && draft) {
      const dest =
        /^anywhere$/i.test(text) || text === "*"
          ? draft.origin
          : text.toUpperCase();
      draft.destination = dest;
      session.step = "campaign_more_filters";
      await ctx.reply(
        `Destination updated: ${formatRoute(draft.origin, draft.destination)}\n\nOptional filters:`,
        { reply_markup: filtersMenuKeyboard() },
      );
      return;
    }

    if (session.step === "campaign_filter_radius" && session.userId && draft) {
      const miles = Number(text.replace(/mi$/i, "").trim());
      if (!Number.isFinite(miles) || miles <= 0) {
        await ctx.reply("Enter a positive number of miles (e.g. 50).");
        return;
      }
      draft.radius = miles;
      session.step = "campaign_more_filters";
      await ctx.reply(
        `Radius updated: ${miles}mi\n\nOptional filters:`,
        { reply_markup: filtersMenuKeyboard() },
      );
      return;
    }

    if (session.step !== "campaign_readiness_custom" || !session.userId || !draft) {
      return await next();
    }

    const iso = parseReadinessText(text);
    if (!iso) {
      await ctx.reply("Could not parse that time. Try: Jun 25 8am, tomorrow 6pm, +2 hours, or now");
      return;
    }

    await activateCampaign(ctx.chat.id, (t, extra) => ctx.reply(t, extra), session.userId, draft, iso, false);
  });

  bot.callbackQuery(/^status:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }
    try {
      const { profile, dispatch, handoff } = await api.getDispatchStatus(userId);
      const leg = dispatch.activeLeg;
      const legLine = leg
        ? `${leg.mode}: ${formatRoute(String(leg.searchCriteria?.origin ?? "?"), String(leg.searchCriteria?.destination ?? "?"))}`
        : "none";
      const commitment = dispatch.commitment;
      const commitmentLine = commitment
        ? `${commitment.loadId} (${commitment.origin ?? "?"} → ${commitment.destination ?? "?"})`
        : "none";
      const agent = (dispatch as { agentStatus?: { relayWorkState?: string; lastScanSummary?: { scanned: number; booked: boolean; loadId?: string } } }).agentStatus;
      const agentLine = agent?.relayWorkState ? `\nWork state: ${agent.relayWorkState}` : "";
      const scanLine = agent?.lastScanSummary
        ? `\nLast scan: ${agent.lastScanSummary.scanned} loads${agent.lastScanSummary.booked ? `, booked ${agent.lastScanSummary.loadId}` : ""}`
        : "";
      await ctx.reply(
        `Onboarding: ${profile.onboardingStep}\n` +
          `Paused: ${dispatch.paused ? "yes" : "no"}\n` +
          `Active leg: ${legLine}\n` +
          `Commitment: ${commitmentLine}${agentLine}${scanLine}${handoffStatusLine(handoff)}`,
      );
    } catch {
      await ctx.reply("Could not load status.");
    }
  });

  bot.command("status", async (ctx) => {
    const userId = await requireLinkedUser(ctx.chat?.id);
    if (!userId) {
      await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
      return;
    }

    try {
      const { profile, dispatch, handoff } = await api.getDispatchStatus(userId);
      const leg = dispatch.activeLeg;
      const legLine = leg
        ? `${leg.mode}: ${leg.searchCriteria.origin ?? "?"} → ${leg.searchCriteria.destination ?? "?"}`
        : "none";
      const commitment = dispatch.commitment;
      const commitmentLine = commitment
        ? `${commitment.loadId} (${commitment.origin ?? "?"} → ${commitment.destination ?? "?"}) — /complete to clear`
        : "none";
      const pending = (dispatch as { pendingAdoption?: { loadId: string } | null }).pendingAdoption;
      const pendingLine = pending
        ? `\nPending adoption: ${pending.loadId} (check Telegram buttons)`
        : "";
      const readyLine = leg?.readinessWindow
        ? `\nPickup ready: ${formatReadiness(leg.readinessWindow)}`
        : "";
      const armLine = leg
        ? (dispatch as { campaignSessionId?: string | null }).campaignSessionId
          ? "\nExtension: armed for queued leg"
          : commitment
            ? "\nExtension: queued — /complete current trip to arm"
            : "\nExtension: not armed — /campaign → Book now"
        : "";
      await ctx.reply(
        `Onboarding: ${profile.onboardingStep}\n` +
          `Paused: ${dispatch.paused ? "yes" : "no"}\n` +
          `Active leg: ${legLine}${readyLine}\n` +
          `Commitment: ${commitmentLine}${pendingLine}${handoffStatusLine(handoff)}${armLine}`,
      );
    } catch {
      await ctx.reply("Could not load status.");
    }
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
