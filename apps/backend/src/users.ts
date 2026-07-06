import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export interface TermsAcceptance {
  version: string;
  acceptedAt: string;
  acceptedIp?: string;
}

export async function ensureUserByEmail(email: string): Promise<{ id: string; email: string }> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const existing = await db.collection("users").findOne({ email: normalized });
  if (existing?.id) {
    return { id: String(existing.id), email: normalized };
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await db.collection("users").insertOne({
    id,
    email: normalized,
    createdAt: now,
    updatedAt: now,
  });

  return { id, email: normalized };
}

export async function recordTermsAcceptance(
  userId: string,
  terms: TermsAcceptance,
): Promise<void> {
  const db = await getDb();
  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        termsAcceptedAt: terms.acceptedAt,
        termsVersion: terms.version,
        ...(terms.acceptedIp ? { termsAcceptedIp: terms.acceptedIp } : {}),
        updatedAt: terms.acceptedAt,
      },
    },
  );
}

export async function getUserById(userId: string) {
  const db = await getDb();
  return db.collection("users").findOne({ id: userId });
}
