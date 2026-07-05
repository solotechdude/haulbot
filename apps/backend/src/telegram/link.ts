import { getDb } from "../db";

export async function linkTelegramChat(input: {
  userId: string;
  telegramChatId: string;
  telegramUsername?: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.collection("telegram_links").updateOne(
    { userId: input.userId },
    {
      $set: {
        userId: input.userId,
        telegramChatId: input.telegramChatId,
        telegramUsername: input.telegramUsername,
        devStub: false,
        linkedAt: now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function getUserIdByTelegramChat(telegramChatId: string): Promise<string | null> {
  const db = await getDb();
  const link = await db.collection("telegram_links").findOne({ telegramChatId });
  return link?.userId ? String(link.userId) : null;
}

export function telegramDeepLinkUrl(token: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME ?? "agent_haulbot";
  return `https://t.me/${username}?start=auth_${token}`;
}
