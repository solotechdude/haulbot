import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { isVaultConfigured, kvDelete, kvGet, kvPut } from "./client";

/**
 * Relay credential storage. Vault holds the secrets; MongoDB stores refs
 * only. Without Vault: dev keeps a local plaintext copy so the end-to-end
 * flow stays testable, production fails closed.
 */

const TWO_FA_TTL_MS = 5 * 60 * 1000;

function credentialsPath(userId: string): string {
  return `relay/${userId}/credentials`;
}

function twoFaPath(userId: string): string {
  return `relay/${userId}/2fa`;
}

function assertSecretStoreUsable(): void {
  if (!isVaultConfigured() && process.env.NODE_ENV === "production") {
    throw new Error("VAULT_REQUIRED_IN_PRODUCTION");
  }
}

export async function storeRelayCredentials(
  userId: string,
  input: { email: string; password: string },
): Promise<{ require2fa: boolean }> {
  assertSecretStoreUsable();

  const db = await getDb();
  const now = new Date().toISOString();
  const require2fa = process.env.RELAY_REQUIRE_2FA === "true";
  const useVault = isVaultConfigured();
  const vaultRef = useVault
    ? `vault://${credentialsPath(userId)}`
    : `dev://${userId}/relay-creds/${randomUUID()}`;

  if (useVault) {
    await kvPut(credentialsPath(userId), { email: input.email, password: input.password });
  }

  await db.collection("environment_secret_refs").updateOne(
    { userId, type: "relay_credentials" },
    {
      $set: {
        userId,
        type: "relay_credentials",
        vaultRef,
        relayEmail: input.email,
        // Dev-only fallback so the extension flow works without Vault
        ...(useVault ? { devPassword: null } : { devPassword: input.password }),
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
  assertSecretStoreUsable();

  const db = await getDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TWO_FA_TTL_MS).toISOString();
  const useVault = isVaultConfigured();

  if (useVault) {
    await kvPut(twoFaPath(userId), { code, expiresAt });
  }

  await db.collection("environment_secret_refs").updateOne(
    { userId, type: "relay_2fa" },
    {
      $set: {
        userId,
        type: "relay_2fa",
        vaultRef: useVault ? `vault://${twoFaPath(userId)}` : `dev://${userId}/relay-2fa`,
        ...(useVault ? { devCode: null } : { devCode: code }),
        expiresAt,
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

/** Extension login path — the Dispatch Agent signs in to Relay with these. */
export async function getRelayCredentials(
  userId: string,
): Promise<{ email: string; password: string } | null> {
  if (isVaultConfigured()) {
    const secret = await kvGet<{ email: string; password: string }>(credentialsPath(userId));
    return secret?.email && secret.password ? { email: secret.email, password: secret.password } : null;
  }

  const db = await getDb();
  const ref = await db
    .collection("environment_secret_refs")
    .findOne({ userId, type: "relay_credentials" });
  if (!ref?.relayEmail || !ref.devPassword) return null;
  return { email: String(ref.relayEmail), password: String(ref.devPassword) };
}

/** One-time read — the code is deleted once handed to the extension. */
export async function consumeRelay2faCode(userId: string): Promise<string | null> {
  const db = await getDb();

  if (isVaultConfigured()) {
    const secret = await kvGet<{ code: string; expiresAt: string }>(twoFaPath(userId));
    if (!secret?.code) return null;
    await kvDelete(twoFaPath(userId));
    if (new Date(secret.expiresAt).getTime() < Date.now()) return null;
    return secret.code;
  }

  const ref = await db.collection("environment_secret_refs").findOne({ userId, type: "relay_2fa" });
  if (!ref?.devCode) return null;

  await db
    .collection("environment_secret_refs")
    .updateOne({ userId, type: "relay_2fa" }, { $set: { devCode: null } });

  if (ref.expiresAt && new Date(String(ref.expiresAt)).getTime() < Date.now()) return null;
  return String(ref.devCode);
}
