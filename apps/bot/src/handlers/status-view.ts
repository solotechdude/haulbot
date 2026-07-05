import { InlineKeyboard, type Context } from "grammy";
import { formatRouteLabel } from "@haulbot/shared";
import * as api from "../api";
import { formatReadiness } from "../format";
import { handoffStatusLine } from "./handoff";

const RELAY_ACCESS_STATUS: Record<string, string> = {
  permission_denied: "blocked — Relay account needs Load Board permission (ask your carrier admin)",
  session_expired: "signing back in to Relay…",
  login_failed: "blocked — Relay login failed, send /connect_relay",
  "2fa_required": "blocked — send /2fa CODE",
  captcha: "blocked — Relay verification check, retrying",
};

function isMessageNotModified(err: unknown): boolean {
  const desc =
    err && typeof err === "object" && "description" in err
      ? String((err as { description: string }).description)
      : String(err);
  return desc.includes("message is not modified") || desc.includes("MESSAGE_NOT_MODIFIED");
}

export function statusInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Refresh", "status:refresh")
    .text("Full details", "status:details");
}

/** Edit the status callback message in place; never spam a new message when nothing changed. */
export async function editStatusMessage(
  ctx: Context,
  text: string,
  markup: InlineKeyboard = statusInlineKeyboard(),
): Promise<"edited" | "unchanged" | "replied"> {
  const extra = { reply_markup: markup };
  const msg = ctx.callbackQuery?.message;
  if (!msg || !("text" in msg)) {
    await ctx.reply(text, extra);
    return "replied";
  }

  try {
    await ctx.editMessageText(text, extra);
    return "edited";
  } catch (err) {
    if (isMessageNotModified(err)) return "unchanged";
    await ctx.reply(text, extra);
    return "replied";
  }
}

/** Compact status for the Status button and Refresh. */
export function formatShortStatus(status: api.DispatchStatus): string {
  const { dispatch } = status;
  const lines: string[] = [];
  if (dispatch.commitment) {
    lines.push(
      `Trip: ${dispatch.commitment.loadId} (${dispatch.commitment.origin ?? "?"} → ${dispatch.commitment.destination ?? "?"})`,
    );
  }
  if (dispatch.queuedCommitment) {
    lines.push(`Queued: ${dispatch.queuedCommitment.loadId}`);
  }
  if (dispatch.activeLeg) {
    const leg = dispatch.activeLeg;
    lines.push(
      `Hunt: ${formatRouteLabel(leg.searchCriteria.origin ?? "?", leg.searchCriteria.destination ?? "?")}`,
    );
    lines.push(`Book mins: $${leg.hardRules.minRate ?? "?"}/mi · $${leg.hardRules.minPayout ?? "?"} min`);
  }
  lines.push(`Agent: ${dispatch.agentStatus?.relayWorkState ?? "idle"}`);
  if (dispatch.paused) lines.push("Paused");
  return lines.join("\n") || "Idle — tap Start search.";
}

/** Full dispatch status for /status and Full details. */
export function formatFullStatus(status: api.DispatchStatus): string {
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
  const readyLine =
    leg?.readinessWindow && new Date(leg.readinessWindow).getTime() > Date.now()
      ? `\nPickup ready: ${formatReadiness(leg.readinessWindow)}`
      : "";
  const heartbeatFresh =
    dispatch.heartbeatAt && Date.now() - new Date(dispatch.heartbeatAt).getTime() < 2 * 60 * 1000;
  const armLine = leg
    ? status.live === "unreachable"
      ? "\nExtension: OFFLINE — did not respond to live check, not searching"
      : dispatch.relayAccess
        ? "\nExtension: BLOCKED — Relay access issue, not searching"
        : dispatch.watchdogAlert?.kind === "offline" || (dispatch.campaignSessionId && !heartbeatFresh)
          ? "\nExtension: OFFLINE — not searching (no recent check-in)"
          : dispatch.watchdogAlert?.kind === "scan_stalled"
            ? "\nExtension: STALLED — armed but no scans completing, check Relay access"
            : dispatch.campaignSessionId
              ? status.live === "confirmed"
                ? "\nExtension: armed and searching (load board verified just now)"
                : "\nExtension: armed and searching"
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

function agentNeedsLiveProbe(status: api.DispatchStatus): boolean {
  return Boolean(status.dispatch.activeLeg || status.dispatch.campaignSessionId);
}

/** Live probe when armed; returns full status text. */
export async function fetchFullStatus(userId: string): Promise<string> {
  let current: api.DispatchStatus;
  try {
    current = await api.getDispatchStatus(userId);
  } catch {
    return "Could not load status.";
  }

  if (!agentNeedsLiveProbe(current)) {
    return formatFullStatus(current);
  }

  try {
    return formatFullStatus(await api.getDispatchStatus(userId, { fresh: true }));
  } catch {
    return `Live check failed — last known state may be stale:\n\n${formatFullStatus(current)}`;
  }
}

/** Send full status via /status — may send a "checking…" line first when probing. */
export async function replyWithFreshFullStatus(
  userId: string,
  reply: (text: string) => Promise<unknown>,
): Promise<void> {
  let current: api.DispatchStatus | null = null;
  try {
    current = await api.getDispatchStatus(userId);
  } catch {
    await reply("Could not load status.");
    return;
  }

  if (!agentNeedsLiveProbe(current)) {
    await reply(formatFullStatus(current));
    return;
  }

  await reply("Checking your agent live — this can take up to half a minute…");
  try {
    await reply(formatFullStatus(await api.getDispatchStatus(userId, { fresh: true })));
  } catch {
    await reply(
      `Live check failed — showing last known state, it may be stale:\n\n${formatFullStatus(current)}`,
    );
  }
}
