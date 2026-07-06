import { getDb, upsertDispatchState } from "../db";
import { notifyEnvironmentReady } from "../email/notify-environment-ready";
import { getEnvironmentDriver, type ProvisionedEnvironmentInfo } from "./driver";

async function recordEnvironmentEvent(
  userId: string,
  environmentId: string,
  type: string,
  message: string,
): Promise<void> {
  const db = await getDb();
  await db.collection("environment_events").insertOne({
    userId,
    environmentId,
    type,
    message,
    createdAt: new Date().toISOString(),
  });
}

export async function provisionDedicatedEnvironment(userId: string): Promise<void> {
  const db = await getDb();

  const existing = await db.collection("provisioned_environments").findOne({ userId });
  if (existing?.provisionState === "ready") return;

  const now = new Date().toISOString();
  const driver = await getEnvironmentDriver();

  let info: ProvisionedEnvironmentInfo;
  try {
    info = await driver.create(userId);
  } catch (err) {
    await db.collection("provisioned_environments").updateOne(
      { userId },
      {
        $set: { userId, provisionState: "failed", lastError: (err as Error).message, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    await recordEnvironmentEvent(userId, "none", "provision_failed", (err as Error).message);
    throw err;
  }

  await db.collection("provisioned_environments").updateOne(
    { userId },
    {
      $set: {
        userId,
        environmentId: info.environmentId,
        provider: info.provider,
        portalArn: info.portalArn ?? null,
        portalEndpoint: info.portalEndpoint ?? null,
        provisionState: "ready",
        productTier: "SOLO",
        extensionInstalled: true,
        lastError: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await upsertDispatchState({
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  });

  await recordEnvironmentEvent(
    userId,
    info.environmentId,
    "environment_ready",
    info.provider === "aws"
      ? `Dedicated environment provisioned (${info.portalEndpoint ?? info.portalArn})`
      : "Dedicated environment provisioned (dev stub)",
  );

  void notifyEnvironmentReady(userId);
}

/** Unsubscribe path — the Dedicated Environment lives with the subscription. */
export async function deprovisionEnvironment(userId: string): Promise<void> {
  const db = await getDb();
  const env = await db.collection("provisioned_environments").findOne({ userId });
  if (!env || env.provisionState === "terminated") return;

  const driver = await getEnvironmentDriver();
  await driver.destroy({
    environmentId: String(env.environmentId ?? ""),
    provider: env.provider === "aws" ? "aws" : "dev",
    portalArn: env.portalArn ? String(env.portalArn) : undefined,
  });

  const now = new Date().toISOString();
  await db.collection("provisioned_environments").updateOne(
    { userId },
    { $set: { provisionState: "terminated", updatedAt: now } },
  );
  await recordEnvironmentEvent(
    userId,
    String(env.environmentId ?? "none"),
    "environment_terminated",
    "Dedicated environment terminated on unsubscribe",
  );
}

/** If subscription is active but env missing, provision (webhook recovery). */
export async function ensureProvisionedIfSubscribed(userId: string): Promise<void> {
  const db = await getDb();
  const subscription = await db.collection("subscriptions").findOne({ userId, status: "active" });
  if (!subscription) return;

  const env = await db.collection("provisioned_environments").findOne({ userId });
  if (env?.provisionState === "ready") return;

  await provisionDedicatedEnvironment(userId);
}
