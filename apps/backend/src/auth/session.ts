import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-session-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Stateless HMAC session token: base64url(userId:expiresAtMs).signature */
export function issueSessionToken(userId: string): string {
  const payload = Buffer.from(`${userId}:${Date.now() + SESSION_TTL_MS}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const sep = decoded.lastIndexOf(":");
  if (sep <= 0) return null;

  const userId = decoded.slice(0, sep);
  const expiresAt = Number(decoded.slice(sep + 1));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return userId;
}
