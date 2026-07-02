import { InlineKeyboard, type Bot } from "grammy";
import { formatCampaignStatusMessage, formatRouteLabel } from "@relaybooking/shared";
import * as api from "../api";
import { formatReadiness, readinessFromPreset } from "../format";
import { requireLinkedCallbackUser, requireLinkedUser } from "../linked-user";
import { parseReadinessText } from "../parse-readiness";
import { handoffStatusLine } from "./handoff";
import { clearCampaignSession, getSession, type CampaignDraft } from "../session";

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
    `Armed: ${formatRouteLabel(origin, destination)}\n` +
      `Book mins: $${leg.hardRules.minRate}/mi · $${leg.hardRules.minPayout} min payout\n` +
      `Pickup: ${formatReadiness(readinessWindow)}\n` +
      `Status updates in the pinned message above.`,
  );
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
    `Route: ${formatRouteLabel(draft.origin, draft.destination)}\n` +
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

export function registerDispatchHandlers(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "RelayBooking SOLO commands:\n\n" +
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
            `Queued leg active: ${formatRouteLabel(origin, destination)}\n` +
            `Pickup ready: ${formatReadiness(leg.readinessWindow!)}\n` +
            `Extension will apply Relay filters ~2 min before pickup, then search and book.`,
        );
      } else if (leg && dispatch.campaignSessionId) {
        const origin = String(leg.searchCriteria?.origin ?? "?");
        const destination = String(leg.searchCriteria?.destination ?? "?");
        await ctx.reply(
          `Trip ${cleared} marked complete.\n\n` +
            `Queued leg armed: ${formatRouteLabel(origin, destination)} — extension is searching Relay.`,
        );
      } else {
        await ctx.reply(`Trip ${cleared} marked complete. You can start a new campaign.`);
      }
    } catch {
      await ctx.reply("No active trip to complete. Use /status to check.");
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
        `Current: ${formatRouteLabel(draft.origin, draft.destination)}\n\n` +
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
      const readinessWindow = readinessFromPreset(preset) ?? new Date().toISOString();
      await activateCampaign(chatId, (t, extra) => ctx.reply(t, extra), userId, draft, readinessWindow, false);
    }
  });

  bot.callbackQuery(/^adopt:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;
    const { userId } = linked;

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

    if (session.step === "goal_origin" && session.userId && session.goalText) {
      await submitGoal(ctx.chat.id, (t) => ctx.reply(t), session.userId, session.goalText, text);
      return;
    }

    if (session.step === "campaign_filter_destination" && session.userId && draft) {
      const dest =
        /^anywhere$/i.test(text) || text === "*"
          ? draft.origin
          : text.toUpperCase();
      draft.destination = dest;
      session.step = "campaign_more_filters";
      await ctx.reply(
        `Destination updated: ${formatRouteLabel(draft.origin, draft.destination)}\n\nOptional filters:`,
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

  const RELAY_ACCESS_STATUS: Record<string, string> = {
    permission_denied: "blocked — Relay account needs Load Board permission (ask your carrier admin)",
    session_expired: "signing back in to Relay…",
    login_failed: "blocked — Relay login failed, send /connect_relay",
    "2fa_required": "blocked — send /2fa CODE",
    captcha: "blocked — Relay verification check, retrying",
  };

  function formatStatusText(status: api.DispatchStatus): string {
    const { profile, dispatch, handoff } = status;
    const leg = dispatch.activeLeg;
    const legLine = leg
      ? `${leg.mode}: ${formatRouteLabel(leg.searchCriteria.origin ?? "?", leg.searchCriteria.destination ?? "?")}`
      : "none";
    const rulesLine = leg
      ? `\nBook mins: $${leg.hardRules.minRate ?? "?"}/mi · $${leg.hardRules.minPayout ?? "?"} payout · ${leg.searchCriteria.radius ?? 50}mi radius`
      : "";
    const commitment = dispatch.commitment;
    const commitmentLine = commitment
      ? `${commitment.loadId} (${commitment.origin ?? "?"} → ${commitment.destination ?? "?"}) — /complete to clear`
      : "none";
    const agent = dispatch.agentStatus;
    const agentLine = agent?.relayWorkState ? `\nWork state: ${agent.relayWorkState}` : "";
    const scanLine = agent?.lastScanSummary
      ? `\nLast scan: ${agent.lastScanSummary.scanned} loads${agent.lastScanSummary.booked ? `, booked ${agent.lastScanSummary.loadId}` : ""}`
      : "";
    const pendingLine = dispatch.pendingAdoption
      ? `\nPending adoption: ${dispatch.pendingAdoption.loadId} (check Telegram buttons)`
      : "";
    // Stale (past) readiness reads like a pending pickup — show only future windows
    const readyLine =
      leg?.readinessWindow && new Date(leg.readinessWindow).getTime() > Date.now()
        ? `\nPickup ready: ${formatReadiness(leg.readinessWindow)}`
        : "";
    const armLine = leg
      ? dispatch.campaignSessionId
        ? "\nExtension: armed"
        : commitment
          ? "\nExtension: queued — /complete current trip to arm"
          : "\nExtension: not armed — /campaign → Book now"
      : "";
    const accessLine = dispatch.relayAccess
      ? `\nRelay access: ${RELAY_ACCESS_STATUS[dispatch.relayAccess.kind] ?? `blocked (${dispatch.relayAccess.kind})`}`
      : "";

    return (
      `Onboarding: ${profile.onboardingStep}\n` +
      `Paused: ${dispatch.paused ? "yes" : "no"}\n` +
      `Active leg: ${legLine}${rulesLine}${readyLine}\n` +
      `Commitment: ${commitmentLine}${pendingLine}${agentLine}${scanLine}${handoffStatusLine(handoff)}${armLine}${accessLine}`
    );
  }

  bot.callbackQuery(/^status:/, async (ctx) => {
    const linked = await requireLinkedCallbackUser(ctx);
    if (!linked) return;

    try {
      await ctx.reply(formatStatusText(await api.getDispatchStatus(linked.userId)));
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
      await ctx.reply(formatStatusText(await api.getDispatchStatus(userId)));
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
