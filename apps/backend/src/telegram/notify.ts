import { getDb } from "../db";
import { buildReplyKeyboardCells, resolveStartSearchMiniAppUrl, type ReplyKeyboardCell } from "@haulbot/shared";

export type InlineButton = { text: string; callback_data: string };

type TelegramSendResult = { ok: boolean; errBody: string; messageId?: number };

async function callTelegramApi(
  method: string,
  body: Record<string, unknown>,
  buttons?: InlineButton[][],
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — skip", method);
    return { ok: false, errBody: "" };
  }

  if (buttons?.length) {
    body.reply_markup = {
      inline_keyboard: buttons.map((row) =>
        row.map((b) => ({ text: b.text, callback_data: b.callback_data })),
      ),
    };
  } else if (method === "editMessageText") {
    body.reply_markup = { inline_keyboard: [] };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return { ok: false, errBody };
  }

  const json = (await res.json().catch(() => null)) as {
    result?: { message_id?: number };
  } | null;
  return { ok: true, errBody: "", messageId: json?.result?.message_id };
}

export async function sendTelegramMessageToChat(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<number | null> {
  const result = await callTelegramApi("sendMessage", { chat_id: chatId, text }, buttons);
  if (!result.ok) {
    if (result.errBody) console.warn("[telegram] send failed", result.errBody);
    return null;
  }
  return result.messageId ?? null;
}

export async function sendTelegramMessage(
  userId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<boolean> {
  const db = await getDb();
  const link = await db.collection("telegram_links").findOne({ userId });
  const chatId = link?.telegramChatId;
  if (!chatId) {
    console.warn("[telegram] no chat for user", userId);
    return false;
  }

  const messageId = await sendTelegramMessageToChat(String(chatId), text, buttons);
  if (messageId == null) return false;

  console.log("[telegram] sent to user", userId);
  return true;
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<boolean> {
  const result = await callTelegramApi(
    "editMessageText",
    { chat_id: chatId, message_id: messageId, text },
    buttons,
  );
  if (!result.ok) {
    if (result.errBody && !result.errBody.includes("message is not modified")) {
      console.warn("[telegram] edit failed", result.errBody);
    }
    return false;
  }
  return true;
}

export async function pinChatMessage(chatId: string, messageId: number): Promise<void> {
  await callTelegramApi("pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: true,
  });
}

export async function unpinChatMessage(chatId: string, messageId: number): Promise<void> {
  await callTelegramApi("unpinChatMessage", { chat_id: chatId, message_id: messageId });
}

export async function deleteTelegramMessage(chatId: string, messageId: number): Promise<void> {
  await callTelegramApi("deleteMessage", { chat_id: chatId, message_id: messageId });
}

const lastReplyKeyboard = new Map<string, string>();

function replyKeyboardCellToTelegram(cell: ReplyKeyboardCell): Record<string, unknown> {
  if (cell.type === "web_app") {
    return { text: cell.label, web_app: cell.web_app };
  }
  return { text: cell.label };
}

function startSearchMiniAppUrl(): string | null {
  return resolveStartSearchMiniAppUrl({
    websiteUrl: process.env.WEBSITE_URL,
    miniAppUrlOverride: process.env.TELEGRAM_MINI_APP_URL,
  });
}

/** Swap bottom reply keyboard. Do not delete the carrier message — Telegram removes the keyboard when it is deleted. */
export async function updateReplyKeyboard(chatId: string, rows: ReplyKeyboardCell[][]): Promise<void> {
  const signature = JSON.stringify(rows);
  if (lastReplyKeyboard.get(chatId) === signature) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      // Zero-width space — valid text, invisible in most clients.
      text: "\u200b",
      disable_notification: true,
      reply_markup: {
        keyboard: rows.map((row) => row.map(replyKeyboardCellToTelegram)),
        resize_keyboard: true,
        is_persistent: true,
      },
    }),
  });

  if (!sendRes.ok) {
    const errBody = await sendRes.text().catch(() => "");
    if (errBody && !errBody.includes("message is not modified")) {
      console.warn("[telegram] reply keyboard update failed", errBody);
    }
    return;
  }

  lastReplyKeyboard.set(chatId, signature);
}

/** Refresh bottom keyboard after dispatch state changes — silent, deduped. */
export async function syncReplyKeyboardForUser(
  userId: string,
  input: { hasCommitment: boolean; paused: boolean },
  force = false,
): Promise<void> {
  const db = await getDb();
  const link = await db.collection("telegram_links").findOne({ userId });
  const chatId = link?.telegramChatId;
  if (!chatId) return;
  if (force) lastReplyKeyboard.delete(String(chatId));
  await updateReplyKeyboard(
    String(chatId),
    buildReplyKeyboardCells(input, startSearchMiniAppUrl()),
  );
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
}
