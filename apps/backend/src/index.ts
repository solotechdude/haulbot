import { Hono } from "hono";
import { cors } from "hono/cors";
import { ensureIndexes } from "./db";
import { authRoutes } from "./routes/auth";
import { botDispatchRoutes } from "./routes/bot-dispatch";
import { botRoutes } from "./routes/bot";
import { billingRoutes } from "./routes/billing";
import { dispatcherRoutes } from "./routes/dispatcher";
import { onboardingRoutes } from "./routes/onboarding";
import { stripeWebhookRoutes } from "./routes/stripe-webhook";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, service: "relaybooking-backend" }));

app.route("/v1/webhooks", stripeWebhookRoutes);
app.route("/v1/billing", billingRoutes);
app.route("/v1/auth", authRoutes);
app.route("/v1/onboarding", onboardingRoutes);
app.route("/v1/bot", botRoutes);
app.route("/v1/bot/dispatch", botDispatchRoutes);
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
