import { randomUUID } from "node:crypto";
import { getDb, upsertDispatchState } from "./db";

export async function provisionDedicatedEnvironment(userId: string): Promise<void> {
  const database = await getDb();

  const existing = await database.collection("provisioned_environments").findOne({ userId });
  if (existing?.provisionState === "ready") return;

  const now = new Date().toISOString();
  const environmentId = existing?.environmentId ?? randomUUID();

  await database.collection("provisioned_environments").updateOne(
    { userId },
    {
      $set: {
        userId,
        environmentId,
        provisionState: "ready",
        productTier: "SOLO",
        extensionInstalled: true,
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

  await database.collection("environment_events").insertOne({
    userId,
    environmentId,
    type: "environment_ready",
    message: "Dedicated environment provisioned (dev stub)",
    createdAt: now,
  });
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
