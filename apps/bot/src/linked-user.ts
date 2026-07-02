import type { Context } from "grammy";
import * as api from "./api";

/** Chat → linked userId, or null when unlinked/backend unreachable */
export async function requireLinkedUser(chatId: number | undefined): Promise<string | null> {
  if (!chatId) return null;
  try {
    return await api.getUserIdByChat(String(chatId));
  } catch {
    return null;
  }
}

/** Callback-query preamble: ack, resolve chat, require linked user */
export async function requireLinkedCallbackUser(
  ctx: Context,
): Promise<{ chatId: number; userId: string } | null> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return null;

  const userId = await requireLinkedUser(chatId);
  if (!userId) {
    await ctx.reply("Link Telegram first — Connect Telegram on /solo.");
    return null;
  }
  return { chatId, userId };
}
