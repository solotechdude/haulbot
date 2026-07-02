import { Bot } from "grammy";
import * as api from "./api";
import { registerDispatchHandlers } from "./handlers/dispatch";
import { registerHandoffHandlers } from "./handlers/handoff";
import { registerOnboardingHandlers } from "./handlers/onboarding";

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
registerHandoffHandlers(bot);

bot.catch((err) => {
  const grammyErr = err.error as { error_code?: number; description?: string } | undefined;
  const code = grammyErr?.error_code;
  const message = grammyErr?.description ?? err.message ?? String(err);
  console.error("[bot] error:", message);

  if (code === 409 || message.includes("getUpdates")) {
    console.error("[bot] Another bot instance is polling Telegram. Run: bun run bot:stop");
    process.exit(1);
  }
});

let stopping = false;

async function shutdown(signal?: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log("[bot] stopping…", signal ?? "");
  await bot.stop();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await bot.api.deleteWebhook({ drop_pending_updates: false });
console.log("[bot] starting long polling (pid %d)…", process.pid);
await bot.start();
