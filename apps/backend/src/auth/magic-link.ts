import { randomBytes } from "node:crypto";
import { getDb } from "../db";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Full token for web magic links (no length limit) */
export async function issueMagicLinkToken(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await db.collection("users").updateOne(
    { id: userId },
    { $set: { magicLinkToken: token, magicLinkExpiresAt: expiresAt, updatedAt: new Date().toISOString() } },
  );

  return token;
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const db = await getDb();
  const user = await db.collection("users").findOne({ magicLinkToken: token });
  if (!user?.id) return null;

  const expiresAt = user.magicLinkExpiresAt ? new Date(String(user.magicLinkExpiresAt)).getTime() : 0;
  if (expiresAt && expiresAt < Date.now()) return null;

  return String(user.id);
}

/**
 * Short token for Telegram ?start= — Telegram limits payload to 64 chars.
 * auth_ (5) + 24 hex (48) = 53 chars max.
 */
export async function issueTelegramLinkToken(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        telegramLinkToken: token,
        telegramLinkExpiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return token;
}

export async function verifyTelegramLinkToken(token: string): Promise<string | null> {
  const db = await getDb();
  const user = await db.collection("users").findOne({ telegramLinkToken: token });
  if (!user?.id) return null;

  const expiresAt = user.telegramLinkExpiresAt
    ? new Date(String(user.telegramLinkExpiresAt)).getTime()
    : 0;
  if (expiresAt && expiresAt < Date.now()) return null;

  return String(user.id);
}

export function soloPortalUrl(token: string): string {
  const origin = process.env.WEBSITE_URL ?? "http://localhost:3000";
  return `${origin}/solo?token=${token}`;
}
