import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { startMorningBriefingLoop } from "./briefing";
import { ensureIndexes } from "./db";
import { startAgentWatchdog } from "./watchdog";
import { rateLimit } from "./middleware/rate-limit";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { botDispatchRoutes } from "./routes/bot-dispatch";
import { botRoutes } from "./routes/bot";
import { billingRoutes } from "./routes/billing";
import { dispatcherRoutes } from "./routes/dispatcher";
import { onboardingRoutes } from "./routes/onboarding";
import { stripeWebhookRoutes } from "./routes/stripe-webhook";

const app = new Hono();

// Browser callers are the website only; bot/extension are server-to-server
function allowedOrigins(): string[] | "*" {
  const configured = process.env.CORS_ORIGINS ?? process.env.WEBSITE_URL;
  if (!configured) return process.env.NODE_ENV === "production" ? [] : "*";
  return configured.split(",").map((o) => o.trim());
}

app.use("*", cors({ origin: allowedOrigins() }));

// Skip the extension hot path — one line per poll would drown the logs
const HOT_PATHS = ["/v1/dispatcher/state", "/v1/dispatcher/state/heartbeat", "/health"];
app.use("*", async (c, next) => {
  if (HOT_PATHS.includes(new URL(c.req.url).pathname)) return next();
  return logger()(c, next);
});

app.get("/health", (c) => c.json({ ok: true, service: "haulbot-backend" }));

const publicRateLimit = rateLimit({ windowMs: 60_000, max: 20 });

app.route("/v1/webhooks", stripeWebhookRoutes);
app.use("/v1/billing/*", publicRateLimit);
app.route("/v1/billing", billingRoutes);
app.use("/v1/auth/*", publicRateLimit);
app.route("/v1/auth", authRoutes);
app.route("/v1/onboarding", onboardingRoutes);
app.route("/v1/bot", botRoutes);
app.route("/v1/bot/dispatch", botDispatchRoutes);
app.route("/v1/dispatcher", dispatcherRoutes);
app.route("/v1/admin", adminRoutes);

const port = Number(process.env.PORT ?? 8080);

await ensureIndexes().catch((err) => {
  console.warn("[backend] MongoDB indexes skipped:", (err as Error).message);
});

startMorningBriefingLoop();
startAgentWatchdog();

console.log(`[backend] listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
  // Live status probes (/v1/bot/dispatch/status?fresh=1) hold the request up
  // to 25s while the extension re-checks the load board — Bun's default 10s
  // idleTimeout would kill them mid-wait.
  idleTimeout: 40,
};
