import { getDb } from "../db";

export type InlineButton = { text: string; callback_data: string };

async function callTelegramApi(
  method: "sendMessage" | "editMessageText",
  body: Record<string, unknown>,
  buttons?: InlineButton[][],
): Promise<{ ok: boolean; errBody: string }> {
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
  return { ok: true, errBody: "" };
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

  const result = await callTelegramApi("sendMessage", { chat_id: chatId, text }, buttons);
  if (!result.ok) {
    if (result.errBody) console.warn("[telegram] send failed", result.errBody);
    return false;
  }

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
