import type { AgentStatus, RelayWorkState } from "./agent-status.js";
import { formatRouteLabel, relayWorkStateLabel } from "./agent-status.js";
import type { ActiveLeg, Commitment } from "./dispatch.js";
import type { DispatchHandoff } from "./dispatch-plan.js";

export type HuntPhase = "idle" | "searching" | "queued";

export interface DispatchDashboardInput {
  commitment?: Commitment | null;
  queuedCommitment?: Commitment | null;
  activeLeg?: ActiveLeg | null;
  paused?: boolean;
  armed?: boolean;
  agentStatus?: AgentStatus | null;
  relayAccessKind?: string | null;
  handoff?: DispatchHandoff | null;
  watchdogAlert?: { kind: "offline" | "scan_stalled"; at: string } | null;
  uiConfirmComplete?: boolean;
  uiConfirmCancelHunt?: boolean;
  uiRehuntOffer?: boolean;
  rehuntRoute?: { origin?: string; destination?: string };
}

export function resolveHuntPhase(input: DispatchDashboardInput): HuntPhase {
  if (input.queuedCommitment) return "queued";
  if (input.activeLeg && input.armed !== false && !input.paused) return "searching";
  return "idle";
}

function formatPickupShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoneyRules(leg: { hardRules: { minRate?: number; minPayout?: number } }): string {
  const rate = leg.hardRules.minRate;
  const payout = leg.hardRules.minPayout;
  if (rate == null && payout == null) return "";
  return `$${rate ?? "?"}/mi · $${payout ?? "?"} min`;
}

function formatHandoffSection(handoff: DispatchHandoff): string[] {
  const draft = handoff.draftNextLeg;
  const origin = draft.searchCriteria.origin ?? handoff.deliveryCity;
  const destination = draft.searchCriteria.destination ?? origin;
  const lines = [
    "Next leg · Pick pickup time",
    formatRouteLabel(origin, destination),
    formatMoneyRules(draft),
  ];
  const suggested = formatPickupShort(handoff.suggestedReadiness);
  if (suggested) lines.push(`Suggested ${suggested}`);
  lines.push("Tap a button below to start searching.");
  return lines.filter(Boolean);
}

function watchdogBanner(kind: "offline" | "scan_stalled"): string {
  if (kind === "offline") {
    return "⚠️ Agent offline — extension not checking in. Scanning pauses until it reconnects.";
  }
  return "⚠️ Agent not searching — check Relay load board access (permissions or login).";
}

/** Pinned Telegram dispatch dashboard — single live status message. */
export function formatDispatchDashboardMessage(input: DispatchDashboardInput): string {
  const lines: string[] = [];

  if (input.watchdogAlert && !input.relayAccessKind) {
    lines.push(watchdogBanner(input.watchdogAlert.kind));
    lines.push("");
  }

  if (input.relayAccessKind) {
    lines.push("Relay access blocked — fix login or permissions on Relay.");
    lines.push("Searching resumes automatically when access is restored.");
    return lines.join("\n");
  }

  if (input.uiRehuntOffer && input.rehuntRoute) {
    lines.push("Trip complete.");
    lines.push(
      `Start next hunt (+3h)?\nLast route: ${formatRouteLabel(input.rehuntRoute.origin, input.rehuntRoute.destination)}`,
    );
    return lines.join("\n");
  }

  if (input.commitment) {
    lines.push("Current trip");
    lines.push(
      `${formatRouteLabel(input.commitment.origin, input.commitment.destination)} · ${input.commitment.loadId}`,
    );
    if (input.uiConfirmComplete) {
      lines.push("");
      lines.push(`Mark trip ${input.commitment.loadId} complete?`);
      return lines.join("\n");
    }
    lines.push("");
  }

  if (input.uiConfirmCancelHunt) {
    lines.push("Cancel the active next-leg search?");
    return lines.join("\n");
  }

  const phase = resolveHuntPhase(input);
  const leg = input.activeLeg;

  if (input.handoff && !leg && !input.queuedCommitment) {
    lines.push(...formatHandoffSection(input.handoff));
    return lines.join("\n");
  }

  if (phase === "queued" && input.queuedCommitment) {
    const q = input.queuedCommitment;
    lines.push("Next leg · Booked");
    lines.push(`${formatRouteLabel(q.origin, q.destination)} · ${q.loadId}`);
    const pickup = formatPickupShort(q.pickupAt);
    if (pickup) lines.push(`Pickup ${pickup}`);
    lines.push("2 trips active — complete current trip to activate the next load.");
    return lines.join("\n");
  }

  if (phase === "searching" && leg) {
    const origin = leg.searchCriteria.origin;
    const destination = leg.searchCriteria.destination ?? origin;
    lines.push("Next leg · Searching");
    lines.push(formatRouteLabel(origin, destination));
    const rules = formatMoneyRules(leg);
    if (rules) lines.push(rules);
    const pickup = formatPickupShort(leg.readinessWindow ?? leg.searchOpensAt);
    if (pickup) lines.push(`Pickup target ${pickup}`);

    if (input.paused) {
      lines.push("Paused — tap Resume to continue.");
    } else {
      const ws: RelayWorkState = input.agentStatus?.relayWorkState ?? "idle";
      lines.push(`Agent: ${relayWorkStateLabel(ws)}`);
      const scan = input.agentStatus?.lastScanSummary;
      if (scan) {
        const when = new Date(scan.at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        if (scan.booked && scan.loadId) {
          lines.push(`Last scan (${when}): booked ${scan.loadId}`);
        } else {
          lines.push(`Last scan (${when}): ${scan.scanned} loads, no match`);
        }
      }
    }
    return lines.join("\n");
  }

  if (leg && !input.commitment) {
    lines.push("Searching");
    lines.push(formatRouteLabel(leg.searchCriteria.origin, leg.searchCriteria.destination));
    const ws: RelayWorkState = input.agentStatus?.relayWorkState ?? "idle";
    lines.push(`Agent: ${relayWorkStateLabel(ws)}`);
    return lines.join("\n");
  }

  if (input.commitment) {
    lines.push("No next leg scheduled.");
    return lines.join("\n");
  }

  return "No active dispatch — tap Start search when ready.";
}

export type InlineButton = { text: string; callback_data: string };

/** Inline keyboard for active hunt (time edits + pause/resume). */
export function buildHuntInlineKeyboard(phase: HuntPhase, paused = false): InlineButton[][] {
  if (phase !== "searching") return [];
  const pauseRow: InlineButton[] = paused
    ? [{ text: "Resume", callback_data: "dispatch:resume" }]
    : [{ text: "Pause", callback_data: "dispatch:pause" }];
  return [
    pauseRow,
    [
      { text: "+1 hour late", callback_data: "hunt:late:+1h" },
      { text: "+2 hours late", callback_data: "hunt:late:+2h" },
    ],
    [{ text: "Other time…", callback_data: "hunt:late:custom" }],
    [{ text: "Cancel hunt", callback_data: "hunt:cancel" }],
  ];
}

export function buildHandoffInlineKeyboard(): InlineButton[][] {
  return [
    [{ text: "Start searching (+3h)", callback_data: "handoff:+3h" }],
    [
      { text: "+1 hour", callback_data: "handoff:+1h" },
      { text: "Other time…", callback_data: "handoff:custom" },
    ],
    [{ text: "Tomorrow 8am", callback_data: "handoff:tomorrow8" }],
    [{ text: "Edit search…", callback_data: "handoff:wizard" }],
    [{ text: "Cancel next leg", callback_data: "handoff:skip" }],
  ];
}

function completeTripRow(): InlineButton[][] {
  return [[{ text: COMPLETE_TRIP_LABEL, callback_data: "complete:prompt" }]];
}

function withCompleteTrip(input: DispatchDashboardInput, rows: InlineButton[][]): InlineButton[][] {
  if (!input.commitment || input.uiConfirmComplete) return rows;
  if (rows.length === 0) return completeTripRow();
  return [...completeTripRow(), ...rows];
}

/** All inline actions for the pinned dashboard — replaces separate chat messages. */
export function buildDashboardInlineKeyboard(input: DispatchDashboardInput): InlineButton[][] {
  if (input.uiConfirmComplete) {
    return [
      [
        { text: "Yes, trip done", callback_data: "complete:yes" },
        { text: "Not yet", callback_data: "complete:no" },
      ],
    ];
  }
  if (input.uiConfirmCancelHunt) {
    return [
      [
        { text: "Yes, cancel hunt", callback_data: "hunt:cancel:yes" },
        { text: "Keep searching", callback_data: "hunt:cancel:no" },
      ],
    ];
  }
  if (input.uiRehuntOffer) {
    return [
      [
        { text: "Yes, hunt", callback_data: "rehunt:yes" },
        { text: "Not now", callback_data: "rehunt:no" },
      ],
    ];
  }
  if (input.handoff && !input.activeLeg && !input.queuedCommitment) {
    return withCompleteTrip(input, buildHandoffInlineKeyboard());
  }
  return withCompleteTrip(input, buildHuntInlineKeyboard(resolveHuntPhase(input), input.paused));
}

export type ReplyKeyboardRow = string[];

export const START_SEARCH_LABEL = "Start search";
export const COMPLETE_TRIP_LABEL = "Complete trip";

export type ReplyKeyboardCell =
  | { type: "text"; label: string }
  | { type: "web_app"; label: string; web_app: { url: string } };

export const LOCATION_MINI_APP_PATH = "/telegram/location.html";

export function locationMiniAppUrl(websiteBaseUrl: string): string {
  return `${websiteBaseUrl.replace(/\/$/, "")}${LOCATION_MINI_APP_PATH}`;
}

/** Telegram Web App buttons require HTTPS. Returns null when only HTTP is available. */
export function resolveStartSearchMiniAppUrl(env: {
  websiteUrl?: string;
  miniAppUrlOverride?: string;
}): string | null {
  const override = env.miniAppUrlOverride?.trim();
  const url =
    override ||
    (env.websiteUrl ? locationMiniAppUrl(env.websiteUrl) : null);
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function startSearchKeyboardCell(miniAppUrl: string | null): ReplyKeyboardCell {
  if (miniAppUrl) {
    return {
      type: "web_app",
      label: START_SEARCH_LABEL,
      web_app: { url: miniAppUrl },
    };
  }
  return { type: "text", label: START_SEARCH_LABEL };
}

/** Bottom keyboard: Complete trip whenever a current or queued load is active. */
export function resolveReplyKeyboardState(input: {
  commitment?: { loadId?: string } | null;
  queuedCommitment?: { loadId?: string } | null;
  paused?: boolean;
}): { hasCommitment: boolean; paused: boolean } {
  return {
    hasCommitment: Boolean(input.commitment || input.queuedCommitment),
    paused: Boolean(input.paused),
  };
}

/** Contextual bottom reply keyboard — Start search opens the location Mini App when idle. */
export function buildReplyKeyboardCells(
  input: { hasCommitment: boolean; paused: boolean },
  startSearchMiniAppUrl: string | null,
): ReplyKeyboardCell[][] {
  const pauseLabel = input.paused ? "Resume" : "Pause";
  const primary: ReplyKeyboardCell = input.hasCommitment
    ? { type: "text", label: COMPLETE_TRIP_LABEL }
    : startSearchKeyboardCell(startSearchMiniAppUrl);
  return [[primary, { type: "text", label: "Status" }, { type: "text", label: pauseLabel }]];
}

/** Label-only rows (legacy). Prefer buildReplyKeyboardCells for bot keyboards. */
export function buildReplyKeyboardRows(input: {
  hasCommitment: boolean;
  paused: boolean;
}): ReplyKeyboardRow[] {
  const pauseLabel = input.paused ? "Resume" : "Pause";
  const primary = input.hasCommitment ? COMPLETE_TRIP_LABEL : START_SEARCH_LABEL;
  return [[primary, "Status", pauseLabel]];
}

/** True when extension should scan for the next leg while current trip is active. */
export function isHuntingForQueued(state: {
  commitment?: Commitment | null;
  activeLeg?: ActiveLeg | null;
  queuedCommitment?: Commitment | null;
  campaignSessionId?: string | null;
  paused?: boolean;
}): boolean {
  return Boolean(
    state.commitment &&
      state.activeLeg &&
      state.campaignSessionId &&
      !state.queuedCommitment &&
      !state.paused,
  );
}

/** Whether the pinned dashboard should stay visible. */
export function isDashboardActive(input: DispatchDashboardInput): boolean {
  return Boolean(
    input.commitment ||
      input.queuedCommitment ||
      input.activeLeg ||
      input.handoff ||
      input.uiConfirmComplete ||
      input.uiConfirmCancelHunt ||
      input.uiRehuntOffer ||
      input.relayAccessKind,
  );
}
