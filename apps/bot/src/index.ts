import { Bot, webhookCallback } from "grammy";
import * as api from "./api";
import { registerDispatchHandlers } from "./handlers/dispatch";
import { registerHandoffHandlers } from "./handlers/handoff";
import { registerHuntHandlers, registerKeyboardHandlers } from "./handlers/keyboard";
import { registerOnboardingHandlers } from "./handlers/onboarding";
import { registerCampaignWizard } from "./handlers/campaign-wizard";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("[bot] TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

await api.checkBackendHealth().catch((err) => {
  console.warn("[bot] backend not reachable:", (err as Error).message);
});

const bot = new Bot(token);

bot.use(async (ctx, next) => {
  const text = ctx.message?.text;
  if (text?.startsWith("/")) {
    console.log("[bot] command", text.split(/\s/)[0], "chat", ctx.chat?.id);
  }
  await next();
});

registerOnboardingHandlers(bot);
registerDispatchHandlers(bot);
registerCampaignWizard(bot);
registerHandoffHandlers(bot);
registerHuntHandlers(bot);
registerKeyboardHandlers(bot);

bot.catch((err) => {
  const grammyErr = err.error as { error_code?: number; description?: string } | undefined;
  const message = grammyErr?.description ?? err.message ?? String(err);
  console.error("[bot] handler error:", message);
});

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

if (webhookUrl) {
  // Production — Telegram pushes updates; no getUpdates conflicts across replicas
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
  const port = Number(process.env.BOT_PORT ?? 8081);
  const path = new URL(webhookUrl).pathname;

  await bot.init();
  try {
    await bot.api.setWebhook(webhookUrl, { secret_token: secretToken });
  } catch (err) {
    console.warn("[bot] setWebhook failed — DNS may not be live yet:", (err as Error).message);
  }

  const handleUpdate = webhookCallback(bot, "std/http", { secretToken });

  Bun.serve({
    port,
    fetch: async (req) => {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname === path) {
        return handleUpdate(req);
      }
      if (url.pathname === "/health") {
        return Response.json({ ok: true, service: "haulbot-bot", mode: "webhook" });
      }
      return new Response("Not found", { status: 404 });
    },
  });

  console.log("[bot] webhook mode on :%d (path %s)", port, path);
} else {
  let stopping = false;

  const shutdown = async (signal?: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log("[bot] stopping…", signal ?? "");
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  while (!stopping) {
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      console.log("[bot] starting long polling (pid %d)…", process.pid);
      await bot.start();
      break;
    } catch (err) {
      if (stopping) break;
      const grammyErr = err as { error_code?: number; description?: string };
      const code = grammyErr?.error_code;
      const message = grammyErr?.description ?? (err as Error).message ?? String(err);
      if (code === 409 || message.includes("setWebhook") || message.includes("getUpdates")) {
        console.warn(
          "[bot] polling conflict — another webhook/poller touched this token; clearing webhook and retrying in 3s…",
        );
        await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
        await sleep(3000);
        continue;
      }
      throw err;
    }
  }
}
