import type { DispatchState } from "@relaybooking/shared";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/relaybooking";

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

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("dispatch_states").createIndex({ userId: 1 }, { unique: true });
  await db.collection("dispatch_plans").createIndex({ userId: 1 }, { unique: true });
}
