import { Hono } from "hono";
import { cors } from "hono/cors";
import { ensureIndexes } from "./db";
import { dispatcherRoutes } from "./routes/dispatcher";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, service: "relaybooking-backend" }));

app.route("/v1/dispatcher", dispatcherRoutes);

const port = Number(process.env.PORT ?? 8080);

await ensureIndexes().catch((err) => {
  console.warn("[backend] MongoDB indexes skipped:", (err as Error).message);
});

console.log(`[backend] listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
