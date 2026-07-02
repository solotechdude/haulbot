import type { DispatchPlan, DispatchState } from "@relaybooking/shared";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27019/relaybooking_solo";

let client: import("mongodb").MongoClient | null = null;

export async function getDb() {
  const { MongoClient } = await import("mongodb");
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db();
}

export async function getDispatchState(userId: string): Promise<DispatchState | null> {
  const db = await getDb();
  const doc = await db.collection("dispatch_states").findOne({ userId });
  if (!doc) return null;
  const { _id, ...rest } = doc as DispatchState & { _id: unknown };
  return rest;
}

export async function upsertDispatchState(state: DispatchState): Promise<void> {
  const db = await getDb();
  await db.collection("dispatch_states").updateOne(
    { userId: state.userId },
    { $set: state },
    { upsert: true },
  );
}

export async function getDispatchPlan(userId: string): Promise<DispatchPlan | null> {
  const db = await getDb();
  const doc = await db.collection("dispatch_plans").findOne({ userId });
  if (!doc) return null;
  const { _id, ...rest } = doc as DispatchPlan & { _id: unknown };
  return rest;
}

export async function upsertDispatchPlan(plan: DispatchPlan): Promise<void> {
  const db = await getDb();
  await db.collection("dispatch_plans").updateOne(
    { userId: plan.userId },
    { $set: plan },
    { upsert: true },
  );
}

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("dispatch_states").createIndex({ userId: 1 }, { unique: true });
  await db.collection("dispatch_plans").createIndex({ userId: 1 }, { unique: true });
  await db.collection("subscriptions").createIndex({ userId: 1 }, { unique: true });
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection("provisioned_environments").createIndex({ userId: 1 }, { unique: true });
  await db.collection("telegram_links").createIndex({ userId: 1 }, { unique: true });
  await db.collection("telegram_links").createIndex({ telegramChatId: 1 }, { unique: true });
  await db.collection("relay_alerts").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("load_telemetry").createIndex({ userId: 1, createdAt: -1 });
  // TTL — local copy only; the analytics engine is the long-term store
  await db.collection("load_telemetry").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 },
  );
  await db.collection("board_health").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60 },
  );
}
