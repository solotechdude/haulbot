import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Email sign-in links are short-lived and single-use. */
const SIGNIN_TTL_MS = 15 * 60 * 1000;
/** Checkout auto-login links survive the Stripe redirect and reloads. */
const CHECKOUT_TTL_MS = TOKEN_TTL_MS;

/** Tokens are bearer secrets — only their hash is stored at rest. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueToken(userId: string, ttlMs: number, singleUse: boolean): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        magicLinkTokenHash: hashToken(token),
        magicLinkExpiresAt: expiresAt,
        magicLinkSingleUse: singleUse,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return token;
}

/** Short-lived (15 min), single-use link emailed from the sign-in page. */
export function issueSignInToken(userId: string): Promise<string> {
  return issueToken(userId, SIGNIN_TTL_MS, true);
}

/** 7-day, reusable link threaded through the Stripe checkout redirect. */
export function issueCheckoutToken(userId: string): Promise<string> {
  return issueToken(userId, CHECKOUT_TTL_MS, false);
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const db = await getDb();
  const tokenHash = hashToken(token);
  const user = await db.collection("users").findOne({ magicLinkTokenHash: tokenHash });
  if (!user?.id) return null;

  const expiresAt = user.magicLinkExpiresAt ? new Date(String(user.magicLinkExpiresAt)).getTime() : 0;
  if (expiresAt && expiresAt < Date.now()) return null;

  if (user.magicLinkSingleUse) {
    // Atomically consume so a replayed link (email prefetch, double-click) fails.
    const consumed = await db.collection("users").findOneAndUpdate(
      { id: user.id, magicLinkTokenHash: tokenHash },
      { $unset: { magicLinkTokenHash: "", magicLinkExpiresAt: "", magicLinkSingleUse: "" } },
    );
    if (!consumed) return null;
  }

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
