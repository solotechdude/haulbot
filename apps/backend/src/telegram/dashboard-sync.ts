import type { AgentStatus, DispatchState } from "@haulbot/shared";
import {
  buildDashboardInlineKeyboard,
  formatDispatchDashboardMessage,
  isDashboardActive,
  resolveReplyKeyboardState,
  type DispatchDashboardInput,
} from "@haulbot/shared";
import { getDb, getDispatchPlan, getDispatchState, upsertDispatchState } from "../db";
import {
  deleteTelegramMessage,
  editTelegramMessage,
  pinChatMessage,
  sendTelegramMessageToChat,
  syncReplyKeyboardForUser,
  unpinChatMessage,
} from "./notify";

/** Tracks last pinned dashboard text per user — detects handoff/book phase changes heartbeats skip. */
const lastPinText = new Map<string, string>();

function rememberPinText(userId: string, text: string): void {
  lastPinText.set(userId, text);
}

function pinTextChanged(userId: string, text: string): boolean {
  const prev = lastPinText.get(userId);
  if (prev === text) return false;
  rememberPinText(userId, text);
  return true;
}

function dashboardInput(state: DispatchState, handoff: DispatchDashboardInput["handoff"]): DispatchDashboardInput {
  const canceled = state.canceledHunt;
  return {
    commitment: state.commitment,
    queuedCommitment: state.queuedCommitment,
    activeLeg: state.activeLeg,
    paused: state.paused,
    armed: Boolean(state.campaignSessionId),
    agentStatus: state.agentStatus,
    relayAccessKind: state.relayAccess?.kind ?? null,
    handoff,
    watchdogAlert: state.watchdogAlert,
    uiConfirmComplete: state.uiConfirmComplete,
    uiConfirmCancelHunt: state.uiConfirmCancelHunt,
    uiRehuntOffer: state.uiRehuntOffer,
    rehuntRoute: canceled
      ? {
          origin: canceled.searchCriteria.origin,
          destination: canceled.searchCriteria.destination,
        }
      : undefined,
  };
}

async function chatIdForUser(userId: string): Promise<string | null> {
  const db = await getDb();
  const link = await db.collection("telegram_links").findOne({ userId });
  return link?.telegramChatId ? String(link.telegramChatId) : null;
}

async function loadHandoff(userId: string): Promise<DispatchDashboardInput["handoff"]> {
  const plan = await getDispatchPlan(userId);
  return plan?.handoff ?? null;
}

async function tearDownDashboardPin(userId: string, state: DispatchState): Promise<void> {
  const pin = state.campaignStatusPin;
  if (!pin?.messageId) return;

  await unpinChatMessage(String(pin.telegramChatId), pin.messageId);
  await deleteTelegramMessage(String(pin.telegramChatId), pin.messageId);
  state.campaignStatusPin = undefined;
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);
  await syncReplyKeyboardForUser(userId, resolveReplyKeyboardState(state), true);
}

export async function syncDispatchDashboard(
  userId: string,
  state: DispatchState,
  prevAgentStatus?: AgentStatus | null,
): Promise<void> {
  const chatId = await chatIdForUser(userId);
  if (!chatId) return;

  const handoff = await loadHandoff(userId);
  const input = dashboardInput(state, handoff);
  const active = isDashboardActive(input);
  const pin = state.campaignStatusPin;
  const text = formatDispatchDashboardMessage(input);
  const buttons = buildDashboardInlineKeyboard(input);

  if (active && pin?.telegramChatId && pin.messageId) {
    const prevKey = prevAgentStatus
      ? `${prevAgentStatus.relayWorkState}:${prevAgentStatus.lastScanSummary?.at ?? ""}`
      : "";
    const next = state.agentStatus;
    const nextKey = next ? `${next.relayWorkState}:${next.lastScanSummary?.at ?? ""}` : "";
    const agentChanged =
      prevKey !== nextKey || prevAgentStatus?.armed !== next?.armed || !prevAgentStatus;
    if (agentChanged || pinTextChanged(userId, text)) {
      await editTelegramMessage(String(pin.telegramChatId), pin.messageId, text, buttons);
    }
    await pinChatMessage(String(pin.telegramChatId), pin.messageId);
    return;
  }

  if (!active && pin?.telegramChatId && pin.messageId) {
    await tearDownDashboardPin(userId, state);
  }
}

/** Create or refresh dashboard pin. Persists pin id on dispatch state. */
export async function ensureDispatchDashboardPin(userId: string): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state) return;

  const chatId = await chatIdForUser(userId);
  if (!chatId) return;

  const handoff = await loadHandoff(userId);
  const input = dashboardInput(state, handoff);
  if (!isDashboardActive(input)) {
    await tearDownDashboardPin(userId, state);
    return;
  }

  const text = formatDispatchDashboardMessage(input);
  if (!text.trim()) {
    console.warn("[dashboard] skip pin — empty dashboard text", userId);
    return;
  }
  const buttons = buildDashboardInlineKeyboard(input);

  rememberPinText(userId, text);

  if (state.campaignStatusPin?.messageId) {
    await editTelegramMessage(
      String(state.campaignStatusPin.telegramChatId),
      state.campaignStatusPin.messageId,
      text,
      buttons,
    );
    await pinChatMessage(String(state.campaignStatusPin.telegramChatId), state.campaignStatusPin.messageId);
  } else {
    const messageId = await sendTelegramMessageToChat(chatId, text, buttons);
    if (messageId == null) return;
    state.campaignStatusPin = { telegramChatId: chatId, messageId };
    state.updatedAt = new Date().toISOString();
    await upsertDispatchState(state);
    await pinChatMessage(chatId, messageId);
  }

  await syncReplyKeyboardForUser(userId, resolveReplyKeyboardState(state), true);
}

/** @deprecated use syncDispatchDashboard */
export async function syncCampaignStatusMessage(
  userId: string,
  state: DispatchState,
  prevAgentStatus?: AgentStatus | null,
): Promise<void> {
  await syncDispatchDashboard(userId, state, prevAgentStatus);
}

export async function setDashboardUiPrompt(
  userId: string,
  prompt: "complete" | "cancel_hunt" | "rehunt" | null,
): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state) return;

  state.uiConfirmComplete = prompt === "complete";
  state.uiConfirmCancelHunt = prompt === "cancel_hunt";
  state.uiRehuntOffer = prompt === "rehunt";
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);
  await ensureDispatchDashboardPin(userId);
}

export async function clearDashboardUiPrompts(userId: string): Promise<void> {
  const state = await getDispatchState(userId);
  if (!state) return;
  if (!state.uiConfirmComplete && !state.uiConfirmCancelHunt && !state.uiRehuntOffer) return;

  state.uiConfirmComplete = false;
  state.uiConfirmCancelHunt = false;
  state.uiRehuntOffer = false;
  state.updatedAt = new Date().toISOString();
  await upsertDispatchState(state);
  await ensureDispatchDashboardPin(userId);
}
