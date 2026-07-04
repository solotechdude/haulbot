import { Bot } from "grammy";
import * as api from "../api";
import { clearSession, getSession } from "../session";

export function registerOnboardingHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() ?? "";

    if (payload.startsWith("auth_")) {
      const token = payload.slice("auth_".length);
      const chatId = String(ctx.chat.id);
      const username = ctx.from?.username;

      try {
        const { userId } = await api.linkTelegram({
          token,
          telegramChatId: chatId,
          telegramUsername: username,
        });
        clearSession(ctx.chat.id);
        await ctx.reply(
          "Telegram connected to your Haulbot account.\n\nNext: /connect_relay to link your Amazon Relay credentials.",
        );
        console.log("[bot] linked", userId, chatId);
      } catch {
        await ctx.reply("This link is invalid or expired. Open /solo and tap Connect Telegram to get a fresh link.");
      }
      return;
    }

    await ctx.reply(
      "Welcome to Haulbot.\n\nOpen your Subscriber Portal at haulbot.online/solo and tap Connect Telegram to link this chat.",
    );
  });

  bot.command("connect_relay", async (ctx) => {
    const chatId = String(ctx.chat.id);
    let userId: string | null;
    try {
      userId = await api.getUserIdByChat(chatId);
    } catch {
      await ctx.reply("Backend unavailable. Try again in a moment.");
      return;
    }

    if (!userId) {
      await ctx.reply(
        "This Telegram chat isn't linked yet.\n\nOpen /solo → tap Connect Telegram → press Start in Telegram. Then run /connect_relay again.",
      );
      return;
    }

    const session = getSession(ctx.chat.id);
    session.userId = userId;
    session.step = "await_relay_email";
    session.relayEmail = undefined;

    await ctx.reply("Send your Amazon Relay login email (one message, just the email).");
  });

  bot.command("2fa", async (ctx) => {
    const code = ctx.match?.trim();
    const chatId = String(ctx.chat.id);

    if (!code) {
      await ctx.reply("Usage: /2fa 123456");
      return;
    }

    let userId: string | null;
    try {
      userId = await api.getUserIdByChat(chatId);
    } catch {
      await ctx.reply("Backend unavailable. Try again in a moment.");
      return;
    }

    if (!userId) {
      await ctx.reply(
        "This Telegram chat isn't linked yet.\n\nOpen /solo → tap Connect Telegram → press Start in Telegram. Then run /connect_relay again.",
      );
      return;
    }

    try {
      await api.storeRelay2fa(userId, code);
      await ctx.reply("2FA code received. Your agent will complete Relay login shortly.");
    } catch {
      await ctx.reply("Could not save 2FA code. Try again or contact support.");
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return await next();

    const session = getSession(ctx.chat.id);
    if (!session.step || !session.userId) return;

    const text = ctx.message.text.trim();

    if (session.step === "await_relay_email") {
      if (!text.includes("@")) {
        await ctx.reply("That doesn't look like an email. Send your Relay login email.");
        return;
      }
      session.relayEmail = text;
      session.step = "await_relay_password";
      await ctx.reply("Got it. Now send your Relay password (this message is deleted from chat history in production).");
      return;
    }

    if (session.step === "await_relay_password" && session.relayEmail) {
      try {
        const result = await api.storeRelayCredentials(session.userId, session.relayEmail, text);
        clearSession(ctx.chat.id);

        if (result.require2fa) {
          await ctx.reply(
            "Credentials saved. Relay requires 2FA — enter the code with /2fa 123456",
          );
        } else {
          await ctx.reply(
            "Relay credentials saved. Your dedicated agent will sign in to Relay automatically.",
          );
        }
      } catch {
        clearSession(ctx.chat.id);
        await ctx.reply("Could not save credentials. Run /connect_relay to try again.");
      }
    }
  });
}
