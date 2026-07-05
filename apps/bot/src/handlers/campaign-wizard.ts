import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";
import {
  DEFAULT_EQUIPMENT_SUBS,
  DEFAULT_RELAY_RADIUS,
  EQUIPMENT_MAIN_OPTIONS,
  EQUIPMENT_SUB_OPTIONS,
  RELAY_LOAD_TYPES,
  RELAY_PAYOUT_CHIPS,
  RELAY_RADIUS_MILES,
  RELAY_RATE_CHIPS,
  MAX_ORIGINS,
  RELAY_WORK_TYPES,
  equipmentMainLabel,
  formatRouteLabel,
  originMarketLabel,
  resolveMarketCity,
  type EquipmentMain,
  type LastCampaignDefaults,
} from "@haulbot/shared";
import * as api from "../api";
import { formatReadiness, readinessFromPreset } from "../format";
import { requireLinkedCallbackUser, requireLinkedUser } from "../linked-user";
import { parseReadinessText } from "../parse-readiness";
import {
  clearCampaignSession,
  draftOrigin,
  emptyCampaignDraft,
  getSession,
  isAnywhereDestination,
  syncDraftOriginAlias,
  type CampaignDraft,
  type WizardStepId,
} from "../session";

type ReplyFn = (
  text: string,
  extra?: { reply_markup?: InlineKeyboard | Keyboard },
) => Promise<{ message_id: number } | unknown>;

type StepOptions = { ctx?: Context; userId?: string };

function makeWizardReply(ctx: Context, session: ReturnType<typeof getSession>): ReplyFn {
  return async (text, extra) => {
    const chatId = ctx.chat?.id;
    const msgId = session.wizardMessageId;
    const canEdit =
      extra?.reply_markup == null || extra.reply_markup instanceof InlineKeyboard;

    if (chatId && msgId && canEdit) {
      try {
        await ctx.api.editMessageText(chatId, msgId, text, {
          reply_markup: extra?.reply_markup as InlineKeyboard | undefined,
        });
        return { message_id: msgId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("message is not modified")) {
          return { message_id: msgId };
        }
      }
    }

    const oldMsgId = msgId;
    const msg = await ctx.reply(text, extra);
    if (msg && typeof msg === "object" && "message_id" in msg) {
      session.wizardMessageId = msg.message_id as number;
    }
    if (chatId && oldMsgId && oldMsgId !== session.wizardMessageId) {
      try {
        await ctx.api.deleteMessage(chatId, oldMsgId);
      } catch {
        // old wizard message already gone
      }
    }
    return msg;
  };
}

async function deleteWizardMessage(ctx: Context, session: ReturnType<typeof getSession>): Promise<void> {
  const chatId = ctx.chat?.id;
  const msgId = session.wizardMessageId;
  if (!chatId || !msgId) return;
  try {
    await ctx.api.deleteMessage(chatId, msgId);
  } catch {
    // already deleted
  }
  delete session.wizardMessageId;
}

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch {
    // ignore
  }
}

function navRow(backStep?: WizardStepId): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (backStep) kb.text("← Back", `cw:back:${backStep}`);
  kb.text("Cancel", "cw:cancel");
  return kb;
}

function appendNavRow(kb: InlineKeyboard, backStep?: WizardStepId): InlineKeyboard {
  kb.row();
  if (backStep) kb.text("← Back", `cw:back:${backStep}`);
  kb.text("Cancel", "cw:cancel");
  return kb;
}

function pushStep(session: ReturnType<typeof getSession>, step: WizardStepId): void {
  if (!session.wizardStack) session.wizardStack = [];
  const last = session.wizardStack[session.wizardStack.length - 1];
  if (last !== step) session.wizardStack.push(step);
}

function formatEquipment(draft: CampaignDraft): string {
  const eq = draft.equipment;
  if (!eq) return "Tractor and trailer (default)";
  const subs = eq.subs.length ? eq.subs.join(", ") : "All";
  return `${equipmentMainLabel(eq.main)} · ${subs}`;
}

function formatMustHaves(draft: CampaignDraft): string {
  const origins =
    draft.origins.map((o) => originMarketLabel(o)).join(", ") || "?";
  const dest = isAnywhereDestination(draft)
    ? "anywhere"
    : formatRouteLabel(draftOrigin(draft), draft.destination).split(" → ")[1] ?? draft.destination;
  const radius = draft.radius ?? DEFAULT_RELAY_RADIUS;
  let lines =
    `Origins: ${origins}\n` +
    `Destination: ${dest}\n` +
    `Radius: ${radius}mi\n` +
    `Equipment: ${formatEquipment(draft)}\n` +
    `Book mins: $${draft.minRate}/mi · $${draft.minPayout} min payout`;

  if (draft.destinationRadius != null && !isAnywhereDestination(draft)) {
    lines += `\nDest radius: ${draft.destinationRadius}mi`;
  }
  if (draft.workTypes?.length) lines += `\nWork type: ${draft.workTypes.join(", ")}`;
  if (draft.loadTypes?.length) lines += `\nLoad type: ${draft.loadTypes.join(", ")}`;
  if (draft.readinessWindow) {
    lines += `\nPickup: ${formatReadiness(draft.readinessWindow)}`;
  }
  return lines;
}

function formatReview(draft: CampaignDraft): string {
  return `Review search\n\n${formatMustHaves(draft)}\n\nTap Start now when this looks right.`;
}

function applyDefaults(draft: CampaignDraft, defaults?: LastCampaignDefaults | null): void {
  if (!defaults) return;
  if (defaults.radius != null) draft.radius = defaults.radius;
  if (defaults.destinationRadius != null) draft.destinationRadius = defaults.destinationRadius;
  if (defaults.equipment) draft.equipment = { ...defaults.equipment, subs: [...defaults.equipment.subs] };
  if (defaults.minRate != null) draft.minRate = defaults.minRate;
  if (defaults.minPayout != null) draft.minPayout = defaults.minPayout;
  if (defaults.workTypes?.length) draft.workTypes = [...defaults.workTypes];
  if (defaults.loadTypes?.length) draft.loadTypes = [...defaults.loadTypes];
}

function draftToApiPayload(draft: CampaignDraft, readinessWindow: string) {
  const origin = draftOrigin(draft);
  const destination = isAnywhereDestination(draft) ? origin : draft.destination.toUpperCase();
  return {
    origins: draft.origins.map((o) => o.toUpperCase()),
    origin: origin.toUpperCase(),
    destination,
    minRate: draft.minRate,
    minPayout: draft.minPayout,
    radius: draft.radius ?? DEFAULT_RELAY_RADIUS,
    destinationRadius: draft.destinationRadius,
    equipment: draft.equipment,
    workTypes: draft.workTypes,
    loadTypes: draft.loadTypes,
    readinessWindow,
  };
}

export async function activateCampaign(
  ctx: Context,
  userId: string,
  draft: CampaignDraft,
  readinessWindow: string,
  clearCommitment: boolean,
): Promise<void> {
  const chatId = ctx.chat!.id;
  const session = getSession(chatId);
  const wizardMsgId = session.wizardMessageId;

  await api.setCampaign(userId, {
    ...draftToApiPayload(draft, readinessWindow),
    clearCommitment,
  });

  clearCampaignSession(chatId);
  void api.syncDispatchUi(userId);

  if (wizardMsgId) {
    try {
      await ctx.api.deleteMessage(chatId, wizardMsgId);
    } catch {
      // Pin carries live status — wizard message may already be gone.
    }
  }
}

/** First origin — one-tap city button when GPS detected, plus Cancel. */
function originPickKeyboard(suggested?: { label: string; token: string }): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (suggested) {
    kb.text(suggested.label, `cw:o:${suggested.token}`).row();
  }
  return kb.text("Cancel", "cw:cancel");
}

function originStepHint(suggested?: { label: string }): string {
  if (suggested) {
    return `Where are you picking up?\n\nTap ${suggested.label} below, or type a different city.`;
  }
  return `Where are you picking up?\n\nType a city name (e.g. Brampton).`;
}

function suggestedOriginChip(
  session: ReturnType<typeof getSession>,
): { label: string; token: string } | undefined {
  const token = session.detectedOriginToken;
  if (token && token !== "UNKNOWN") {
    return { label: originMarketLabel(token), token };
  }
  return undefined;
}

/** After at least one origin — compact actions, no city grid. */
function originConfirmKeyboard(draft: CampaignDraft): InlineKeyboard {
  const kb = new InlineKeyboard().text("Done → Radius", "cw:o:done");
  if (draft.origins.length < MAX_ORIGINS) kb.text("Add another", "cw:o:add");
  return kb.row().text("Cancel", "cw:cancel");
}

function radiusKeyboard(draft: CampaignDraft): InlineKeyboard {
  const kb = new InlineKeyboard();
  const current = draft.radius ?? DEFAULT_RELAY_RADIUS;
  for (let i = 0; i < RELAY_RADIUS_MILES.length; i += 3) {
    for (let j = i; j < Math.min(i + 3, RELAY_RADIUS_MILES.length); j++) {
      const n = RELAY_RADIUS_MILES[j]!;
      const label = n === current ? `${n}mi ✓` : `${n}mi`;
      kb.text(label, `cw:r:${n}`);
    }
    kb.row();
  }
  return appendNavRow(kb, "origin");
}

function equipmentMainKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const opt of EQUIPMENT_MAIN_OPTIONS) {
    kb.text(opt.label, `cw:em:${opt.id}`).row();
  }
  return appendNavRow(kb, "radius");
}

function equipmentSubsKeyboard(draft: CampaignDraft): InlineKeyboard {
  const main = draft.equipment?.main ?? "tractor_trailer";
  const selected = new Set(draft.equipment?.subs ?? []);
  const options = EQUIPMENT_SUB_OPTIONS[main];
  const kb = new InlineKeyboard();
  for (const sub of options) {
    const mark = selected.has(sub) ? " ✓" : "";
    kb.text(`${sub}${mark}`, `cw:es:${encodeURIComponent(sub)}`).row();
  }
  kb.text("Done → $/mi", "cw:es:done");
  return appendNavRow(kb, "equipment_main");
}

function rateKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const rate of RELAY_RATE_CHIPS) {
    kb.text(`$${rate}`, `cw:rate:${rate}`);
  }
  kb.text("Other…", "cw:rate:other");
  return appendNavRow(kb, "equipment_subs");
}

function payoutKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of RELAY_PAYOUT_CHIPS) {
    kb.text(`$${p}`, `cw:pay:${p}`);
  }
  kb.text("Other…", "cw:pay:other");
  return appendNavRow(kb, "rate");
}

function optionalHubKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Destination", "cw:opt:dest")
    .text("Pickup time", "cw:opt:pickup")
    .row()
    .text("Work type", "cw:opt:work")
    .text("Load type", "cw:opt:load")
    .row()
    .text("Skip → Review", "cw:opt:skip")
    .row()
    .text("← Back", "cw:back:payout")
    .text("Cancel", "cw:cancel");
}

function editHubKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Origins", "cw:edit:origin")
    .text("Radius", "cw:edit:radius")
    .row()
    .text("Equipment", "cw:edit:equip")
    .text("Book mins", "cw:edit:rate")
    .row()
    .text("Destination", "cw:edit:dest")
    .text("Pickup", "cw:edit:pickup")
    .row()
    .text("Done → Review", "cw:edit:done")
    .row()
    .text("Cancel", "cw:cancel");
}

function reviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Start now", "cw:go:now")
    .text("Schedule…", "cw:go:future")
    .row()
    .text("Edit", "cw:go:edit")
    .text("Save preset", "cw:go:preset")
    .row()
    .text("Cancel", "cw:cancel");
}

function timingKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Book now", "cw:go:now")
    .text("Schedule for later", "cw:go:future")
    .row()
    .text("Cancel", "cw:cancel");
}

function readinessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("+1 hour", "cw:ready:+1h")
    .text("+3 hours", "cw:ready:+3h")
    .row()
    .text("Tomorrow 8am", "cw:ready:tomorrow8")
    .row()
    .text("Custom time…", "cw:ready:custom")
    .row()
    .text("Cancel", "cw:cancel");
}

function confirmCompleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Yes — trip is done", "cw:complete:yes")
    .row()
    .text("Cancel", "cw:cancel");
}

function destRadiusKeyboard(draft: CampaignDraft): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < RELAY_RADIUS_MILES.length; i += 3) {
    for (let j = i; j < Math.min(i + 3, RELAY_RADIUS_MILES.length); j++) {
      const n = RELAY_RADIUS_MILES[j]!;
      kb.text(`${n}mi`, `cw:dr:${n}`);
    }
    kb.row();
  }
  kb.text("Skip", "cw:dr:skip");
  return appendNavRow(kb, "optional_dest");
}

function toggleChipKeyboard(
  items: readonly string[],
  selected: string[],
  prefix: string,
  backStep: WizardStepId,
): InlineKeyboard {
  const set = new Set(selected);
  const kb = new InlineKeyboard();
  for (const item of items) {
    const mark = set.has(item) ? " ✓" : "";
    kb.text(`${item}${mark}`, `${prefix}:${encodeURIComponent(item)}`).row();
  }
  kb.text("Done", `${prefix}:done`);
  return appendNavRow(kb, backStep);
}

async function applyOriginCity(
  ctx: Context,
  session: ReturnType<typeof getSession>,
  draft: CampaignDraft,
  city: string,
  reply: ReplyFn,
  userId: string,
): Promise<void> {
  if (city === "UNKNOWN") {
    const suggested = suggestedOriginChip(session);
    await reply(`${originStepHint(suggested)}\n\n⚠️ Could not parse that city.`, {
      reply_markup: originPickKeyboard(suggested),
    });
    return;
  }
  if (draft.origins.length >= MAX_ORIGINS) {
    await reply(`Maximum ${MAX_ORIGINS} origins. Tap Done → Radius.`, {
      reply_markup: originConfirmKeyboard(draft),
    });
    return;
  }
  if (!draft.origins.includes(city)) draft.origins.push(city);
  syncDraftOriginAlias(draft);
  delete session.step;

  const stepOpts = { ctx, userId };
  if (session.wizardEditMode) {
    session.wizardEditMode = false;
    await showStep(reply, "review", draft, session, stepOpts);
    return;
  }
  await showStep(reply, "origin", draft, session, stepOpts);
}

async function showStep(
  reply: ReplyFn,
  step: WizardStepId,
  draft: CampaignDraft,
  session: ReturnType<typeof getSession>,
  options?: StepOptions,
): Promise<void> {
  pushStep(session, step);

  switch (step) {
    case "origin":
      if (draft.origins.length === 0) {
        session.step = "cw_origin_text";
        const suggested = suggestedOriginChip(session);
        await reply(originStepHint(suggested), {
          reply_markup: originPickKeyboard(suggested),
        });
        if (options?.userId) void api.syncDispatchUi(options.userId);
      } else {
        delete session.step;
        const label = draft.origins.map(originMarketLabel).join(", ");
        await reply(
          `Origin${draft.origins.length > 1 ? "s" : ""}: ${label}\n\nAdd another or continue to radius.`,
          { reply_markup: originConfirmKeyboard(draft) },
        );
      }
      break;
    case "radius":
      await reply(`Search radius from origin?`, { reply_markup: radiusKeyboard(draft) });
      break;
    case "equipment_main":
      await reply("Equipment type?", { reply_markup: equipmentMainKeyboard() });
      break;
    case "equipment_subs":
      await reply("Select trailer / size (tap to toggle):", {
        reply_markup: equipmentSubsKeyboard(draft),
      });
      break;
    case "rate":
      await reply("Minimum $/mi to auto-book?", { reply_markup: rateKeyboard() });
      break;
    case "payout":
      await reply("Minimum payout to auto-book?", { reply_markup: payoutKeyboard() });
      break;
    case "optional":
      await reply("Optional filters — or skip to review.", { reply_markup: optionalHubKeyboard() });
      break;
    case "optional_dest":
      await reply("Destination city or anywhere?", {
        reply_markup: new InlineKeyboard()
          .text("Anywhere", "cw:dest:any")
          .text("Type city…", "cw:dest:type")
          .row()
          .text("← Back", "cw:back:optional")
          .text("Cancel", "cw:cancel"),
      });
      break;
    case "optional_dest_radius":
      await reply("Destination search radius?", { reply_markup: destRadiusKeyboard(draft) });
      break;
    case "optional_pickup":
      await reply("Pickup ready time (optional filter on Relay)?", {
        reply_markup: readinessKeyboard(),
      });
      break;
    case "optional_work":
      await reply("Work type (tap to toggle):", {
        reply_markup: toggleChipKeyboard(RELAY_WORK_TYPES, draft.workTypes ?? [], "cw:wt", "optional"),
      });
      break;
    case "optional_load":
      await reply("Load type (tap to toggle):", {
        reply_markup: toggleChipKeyboard(RELAY_LOAD_TYPES, draft.loadTypes ?? [], "cw:lt", "optional"),
      });
      break;
    case "review":
      await reply(formatReview(draft), { reply_markup: reviewKeyboard() });
      break;
    case "edit":
      await reply("Edit which field?", { reply_markup: editHubKeyboard() });
      break;
    case "timing":
      await reply("When do you need this load?", { reply_markup: timingKeyboard() });
      break;
    case "readiness":
      await reply("When will you be ready to pick up?", { reply_markup: readinessKeyboard() });
      break;
    default:
      break;
  }
}

export async function startCampaignWizard(
  ctx: Context,
  userId: string,
  options: {
    prefill?: Partial<CampaignDraft>;
    startStep?: WizardStepId;
    defaults?: LastCampaignDefaults | null;
    detectedOriginToken?: string;
    locationFailed?: boolean;
  } = {},
): Promise<void> {
  const chatId = ctx.chat!.id;
  const session = getSession(chatId);
  session.userId = userId;
  session.wizardStack = [];
  session.wizardEditMode = false;
  delete session.detectedOriginToken;
  // Keep wizardMessageId — re-tapping Start search edits the same bot message.

  const draft = emptyCampaignDraft();
  applyDefaults(draft, options.defaults);
  if (options.prefill) {
    Object.assign(draft, options.prefill);
    if (options.prefill.origins?.length) draft.origins = [...options.prefill.origins];
  }
  syncDraftOriginAlias(draft);
  session.campaignDraft = draft;

  if (options.detectedOriginToken && options.detectedOriginToken !== "UNKNOWN") {
    session.detectedOriginToken = options.detectedOriginToken;
  }

  const start = options.startStep ?? (draft.origins.length ? "radius" : "origin");
  await showStep(makeWizardReply(ctx, session), start, draft, session, { ctx, userId });
}

async function afterMustHaves(
  reply: ReplyFn,
  session: ReturnType<typeof getSession>,
  draft: CampaignDraft,
): Promise<void> {
  if (session.wizardEditMode) {
    session.wizardEditMode = false;
    await showStep(reply, "review", draft, session);
    return;
  }
  await showStep(reply, "optional", draft, session);
}

export function registerCampaignWizard(bot: Bot): void {
  bot.callbackQuery(/^cw:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const session = getSession(chatId);
    const userId = session.userId ?? (await requireLinkedUser(chatId));
    const draft = session.campaignDraft;
    if (!userId || !draft) {
      await deleteWizardMessage(ctx, session);
      clearCampaignSession(chatId);
      return;
    }

    const reply = makeWizardReply(ctx, session);
    const stepOpts = { ctx, userId };
    const action = ctx.callbackQuery.data.replace("cw:", "");

    if (action === "cancel") {
      await deleteWizardMessage(ctx, session);
      clearCampaignSession(chatId);
      return;
    }

    if (action.startsWith("back:")) {
      const target = action.slice(5) as WizardStepId;
      session.wizardStack = [];
      await showStep(reply, target, draft, session, stepOpts);
      return;
    }

    if (action.startsWith("o:")) {
      const val = action.slice(2);
      if (val === "add") {
        session.step = "cw_origin_text";
        const suggested = suggestedOriginChip(session);
        await reply(
          `Origin ${draft.origins.length + 1}/${MAX_ORIGINS} — tap your city below or type a name.`,
          { reply_markup: originPickKeyboard(suggested) },
        );
        return;
      }
      if (val === "done") {
        if (!draft.origins.length) {
          const suggested = suggestedOriginChip(session);
          await reply("⚠️ Add at least one origin first.", {
            reply_markup: originPickKeyboard(suggested),
          });
          return;
        }
        syncDraftOriginAlias(draft);
        delete session.step;
        await showStep(reply, "radius", draft, session, stepOpts);
        return;
      }
      const city = val.toUpperCase();
      if (!draft.origins.includes(city)) draft.origins.push(city);
      syncDraftOriginAlias(draft);
      delete session.step;
      if (session.wizardEditMode) {
        session.wizardEditMode = false;
        await showStep(reply, "review", draft, session, stepOpts);
        return;
      }
      await showStep(reply, "origin", draft, session, stepOpts);
      return;
    }

    if (action.startsWith("r:")) {
      draft.radius = Number(action.slice(2));
      if (session.wizardEditMode) {
        session.wizardEditMode = false;
        await showStep(reply, "review", draft, session);
        return;
      }
      await showStep(reply, "equipment_main", draft, session);
      return;
    }

    if (action.startsWith("em:")) {
      const main = action.slice(3) as EquipmentMain;
      draft.equipment = {
        main,
        subs: [...DEFAULT_EQUIPMENT_SUBS[main]],
      };
      await showStep(reply, "equipment_subs", draft, session);
      return;
    }

    if (action.startsWith("es:")) {
      const val = action.slice(3);
      if (val === "done") {
        if (session.wizardEditMode) {
          session.wizardEditMode = false;
          await showStep(reply, "review", draft, session);
          return;
        }
        await showStep(reply, "rate", draft, session);
        return;
      }
      const sub = decodeURIComponent(val);
      if (!draft.equipment) draft.equipment = { main: "tractor_trailer", subs: ["All"] };
      const subs = draft.equipment.subs;
      const idx = subs.indexOf(sub);
      if (idx >= 0) subs.splice(idx, 1);
      else subs.push(sub);
      if (!subs.length) subs.push("All");
      await showStep(reply, "equipment_subs", draft, session);
      return;
    }

    if (action.startsWith("rate:")) {
      if (action === "rate:other") {
        session.step = "cw_rate_text";
        await reply("Reply with min $/mi (e.g. 3).");
        return;
      }
      draft.minRate = Number(action.slice(5));
      if (session.wizardEditMode) {
        await showStep(reply, "payout", draft, session);
        return;
      }
      await showStep(reply, "payout", draft, session);
      return;
    }

    if (action.startsWith("pay:")) {
      if (action === "pay:other") {
        session.step = "cw_payout_text";
        await reply("Reply with min payout (e.g. 200).");
        return;
      }
      draft.minPayout = Number(action.slice(4));
      await afterMustHaves(reply, session, draft);
      return;
    }

    if (action.startsWith("opt:")) {
      const opt = action.slice(4);
      if (opt === "skip") {
        await showStep(reply, "review", draft, session);
        return;
      }
      if (opt === "dest") await showStep(reply, "optional_dest", draft, session);
      else if (opt === "pickup") await showStep(reply, "optional_pickup", draft, session);
      else if (opt === "work") await showStep(reply, "optional_work", draft, session);
      else if (opt === "load") await showStep(reply, "optional_load", draft, session);
      return;
    }

    if (action === "dest:any") {
      draft.destination = draftOrigin(draft);
      delete draft.destinationRadius;
      await showStep(reply, "optional", draft, session);
      return;
    }
    if (action === "dest:type") {
      session.step = "cw_dest_text";
      await reply("Reply with destination city code (e.g. ATL).");
      return;
    }

    if (action.startsWith("dr:")) {
      if (action === "dr:skip") {
        delete draft.destinationRadius;
      } else {
        draft.destinationRadius = Number(action.slice(3));
      }
      await showStep(reply, "optional", draft, session);
      return;
    }

    if (action.startsWith("wt:") || action.startsWith("lt:")) {
      const isWork = action.startsWith("wt:");
      const val = action.slice(3);
      const key = isWork ? "workTypes" : "loadTypes";
      if (val === "done") {
        await showStep(reply, "optional", draft, session);
        return;
      }
      const item = decodeURIComponent(val);
      const list = draft[key] ?? [];
      const idx = list.indexOf(item);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(item);
      draft[key] = list;
      await showStep(reply, isWork ? "optional_work" : "optional_load", draft, session);
      return;
    }

    if (action.startsWith("edit:")) {
      session.wizardEditMode = true;
      const field = action.slice(5);
      if (field === "done") {
        session.wizardEditMode = false;
        await showStep(reply, "review", draft, session);
        return;
      }
      const map: Record<string, WizardStepId> = {
        origin: "origin",
        radius: "radius",
        equip: "equipment_main",
        rate: "rate",
        dest: "optional_dest",
        pickup: "optional_pickup",
      };
      const step = map[field];
      if (step) await showStep(reply, step, draft, session, stepOpts);
      return;
    }

    if (action === "go:edit") {
      await showStep(reply, "edit", draft, session);
      return;
    }

    if (action === "go:preset") {
      session.step = "cw_preset_name";
      await reply("Name this preset (e.g. Home base):", { reply_markup: reviewKeyboard() });
      return;
    }

    if (action === "go:now" || action === "go:future") {
      if (action === "go:future") {
        await showStep(reply, "readiness", draft, session, stepOpts);
        return;
      }
      const { dispatch } = await api.getDispatchStatus(userId);
      if (dispatch.commitment) {
        await reply(
          `Active trip: ${dispatch.commitment.loadId}\nMark it complete before searching?`,
          { reply_markup: confirmCompleteKeyboard() },
        );
        return;
      }
      await activateCampaign(ctx, userId, draft, new Date().toISOString(), false);
      return;
    }

    if (action === "complete:yes") {
      try {
        await api.completeCommitment(userId);
      } catch {
        await reply("⚠️ Could not clear trip. Try /complete.", {
          reply_markup: confirmCompleteKeyboard(),
        });
        return;
      }
      await activateCampaign(ctx, userId, draft, new Date().toISOString(), true);
      return;
    }

    if (action.startsWith("ready:")) {
      const preset = action.slice(6);
      if (preset === "custom") {
        session.step = "cw_readiness_custom";
        await reply("When ready?\n\nExamples: +1h, 2pm, tomorrow 8am", {
          reply_markup: readinessKeyboard(),
        });
        return;
      }
      const iso = readinessFromPreset(preset) ?? new Date().toISOString();
      if (session.wizardStack?.includes("optional_pickup")) {
        draft.readinessWindow = iso;
        await showStep(reply, "optional", draft, session, stepOpts);
        return;
      }
      const { dispatch } = await api.getDispatchStatus(userId);
      if (dispatch.commitment) {
        await reply("Mark current trip complete first?", {
          reply_markup: confirmCompleteKeyboard(),
        });
        draft.readinessWindow = iso;
        return;
      }
      await activateCampaign(ctx, userId, draft, iso, false);
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();
    if (!ctx.chat?.id) return await next();

    const session = getSession(ctx.chat.id);
    const draft = session.campaignDraft;
    const text = ctx.message.text.trim();
    const reply = makeWizardReply(ctx, session);

    if (session.step === "cw_origin_text" && draft) {
      const userId = session.userId ?? (await requireLinkedUser(ctx.chat.id));
      if (!userId) {
        await ctx.reply("Link your account first with /start.");
        return;
      }
      const city = resolveMarketCity(text);
      await tryDeleteMessage(ctx, ctx.message.message_id);
      await applyOriginCity(ctx, session, draft, city, reply, userId);
      return;
    }

    if (session.step === "cw_dest_text" && draft) {
      draft.destination = /^anywhere$/i.test(text) ? draftOrigin(draft) : text.toUpperCase();
      delete session.step;
      await tryDeleteMessage(ctx, ctx.message.message_id);
      if (!isAnywhereDestination(draft)) {
        await showStep(reply, "optional_dest_radius", draft, session);
      } else {
        delete draft.destinationRadius;
        await showStep(reply, "optional", draft, session);
      }
      return;
    }

    if (session.step === "cw_rate_text" && draft) {
      const rate = Number(text);
      if (!Number.isFinite(rate) || rate <= 0) {
        await reply("Enter a positive number (e.g. 3).", { reply_markup: rateKeyboard() });
        return;
      }
      draft.minRate = rate;
      delete session.step;
      await tryDeleteMessage(ctx, ctx.message.message_id);
      await showStep(reply, "payout", draft, session);
      return;
    }

    if (session.step === "cw_payout_text" && draft) {
      const payout = Number(text);
      if (!Number.isFinite(payout) || payout <= 0) {
        await reply("Enter a positive number (e.g. 200).", { reply_markup: payoutKeyboard() });
        return;
      }
      draft.minPayout = payout;
      delete session.step;
      await tryDeleteMessage(ctx, ctx.message.message_id);
      await afterMustHaves(reply, session, draft);
      return;
    }

    if (session.step === "cw_readiness_custom" && session.userId && draft) {
      const iso = parseReadinessText(text);
      if (!iso) {
        await reply("Could not parse. Try: +1h, 2pm, tomorrow 8am", {
          reply_markup: readinessKeyboard(),
        });
        return;
      }
      delete session.step;
      await tryDeleteMessage(ctx, ctx.message.message_id);
      if (session.wizardStack?.includes("optional_pickup")) {
        draft.readinessWindow = iso;
        await showStep(reply, "optional", draft, session);
        return;
      }
      await activateCampaign(ctx, session.userId, draft, iso, false);
      return;
    }

    if (session.step === "cw_preset_name" && session.userId && draft) {
      const name = text.slice(0, 40);
      delete session.step;
      await tryDeleteMessage(ctx, ctx.message.message_id);
      try {
        await api.saveCampaignPreset(session.userId, name, draft);
        await showStep(reply, "review", draft, session);
      } catch {
        await reply("Could not save preset.", { reply_markup: reviewKeyboard() });
      }
      return;
    }

    if (draft && !session.step && session.wizardStack?.length) {
      await reply("Use the buttons above — or tap Cancel to start over.");
      return;
    }

    return await next();
  });
}

export { formatMustHaves, formatReview };
