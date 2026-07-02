import { getDb } from "../db";

export type InlineButton = { text: string; callback_data: string };

export async function sendTelegramMessage(
  userId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — skip notify");
    return false;
  }

  const db = await getDb();
  const link = await db.collection("telegram_links").findOne({ userId });
  const chatId = link?.telegramChatId;
  if (!chatId) {
    console.warn("[telegram] no chat for user", userId);
    return false;
  }

  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (buttons?.length) {
    body.reply_markup = {
      inline_keyboard: buttons.map((row) =>
        row.map((b) => ({ text: b.text, callback_data: b.callback_data })),
      ),
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.warn("[telegram] send failed", res.status, errBody);
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  if (buttons?.length) {
    body.reply_markup = {
      inline_keyboard: buttons.map((row) =>
        row.map((b) => ({ text: b.text, callback_data: b.callback_data })),
      ),
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (!errBody.includes("message is not modified")) {
      console.warn("[telegram] edit failed", res.status, errBody);
    }
    return false;
  }

  return true;
}
