import { randomUUID } from "node:crypto";
import { getDb } from "../db";

/** Dev vault stub — production uses HashiCorp Vault; Mongo stores refs only */
export async function storeRelayCredentials(
  userId: string,
  input: { email: string; password: string },
): Promise<{ require2fa: boolean }> {
  const db = await getDb();
  const now = new Date().toISOString();
  const vaultRef = `dev://${userId}/relay-creds/${randomUUID()}`;
  const require2fa = process.env.RELAY_REQUIRE_2FA === "true";

  await db.collection("environment_secret_refs").updateOne(
    { userId, type: "relay_credentials" },
    {
      $set: {
        userId,
        type: "relay_credentials",
        vaultRef,
        relayEmail: input.email,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        relayCredsStoredAt: now,
        relay2faPending: require2fa,
        relayReadyAt: require2fa ? null : now,
        updatedAt: now,
      },
    },
  );

  return { require2fa };
}

export async function storeRelay2faCode(userId: string, code: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.collection("environment_secret_refs").updateOne(
    { userId, type: "relay_2fa" },
    {
      $set: {
        userId,
        type: "relay_2fa",
        vaultRef: `dev://${userId}/relay-2fa`,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await db.collection("users").updateOne(
    { id: userId },
    { $set: { relay2faPending: false, relayReadyAt: now, updatedAt: now } },
  );
}
