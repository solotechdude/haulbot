import { Bot } from "grammy";
import * as api from "../api";
import { clearSession, getSession } from "../session";
import { welcomeLinkedUser } from "./keyboard";

const PORTAL_URL = process.env.WEBSITE_URL?.replace(/\/$/, "") ?? "https://haulbot.online/solo";

async function resolveLinkedUserId(chatId: string): Promise<string | null | "unavailable"> {
  try {
    return await api.getUserIdByChat(chatId);
  } catch {
    return "unavailable";
  }
}

export function registerOnboardingHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() ?? "";
    const chatId = String(ctx.chat!.id);

    if (payload.startsWith("auth_")) {
      const token = payload.slice("auth_".length);
      const username = ctx.from?.username;

      try {
        const { userId } = await api.linkTelegram({
          token,
          telegramChatId: chatId,
          telegramUsername: username,
        });
        clearSession(ctx.chat!.id);
        await welcomeLinkedUser(ctx, userId, { firstConnect: true });
        console.log("[bot] linked", userId, chatId);
      } catch (err) {
        const code = (err as Error).message;
        if (code === "CHAT_LINKED_TO_OTHER") {
          await ctx.reply(
            "This Telegram account is already linked to a different Haulbot subscriber.\n\n" +
              `Sign in at ${PORTAL_URL} with your own account, then tap Connect Telegram.`,
          );
          return;
        }
        if (code === "INVALID_TOKEN") {
          await ctx.reply(
            "This link is invalid or expired.\n\n" +
              `Open ${PORTAL_URL} and tap Connect Telegram to get a fresh link.`,
          );
          return;
        }
        await ctx.reply("Could not connect Telegram. Try again from your subscriber portal.");
      }
      return;
    }

    const linked = await resolveLinkedUserId(chatId);
    if (linked === "unavailable") {
      await ctx.reply("Backend unavailable. Try /start again in a moment.");
      return;
    }
    if (linked) {
      clearSession(ctx.chat!.id);
      await welcomeLinkedUser(ctx, linked);
      return;
    }

    await ctx.reply(
      "Welcome to Haulbot.\n\n" +
        `Open your Subscriber Portal at ${PORTAL_URL} and tap Connect Telegram to link this chat.`,
    );
  });

  bot.command("connect_relay", async (ctx) => {
    const chatId = String(ctx.chat!.id);
    let userId: string | null;
    try {
      userId = await api.getUserIdByChat(chatId);
    } catch {
      await ctx.reply("Backend unavailable. Try again in a moment.");
      return;
    }

    if (!userId) {
      await ctx.reply(
        `This Telegram chat isn't linked yet.\n\nOpen ${PORTAL_URL} → tap Connect Telegram → press Start in Telegram. Then run /connect_relay again.`,
      );
      return;
    }

    const session = getSession(ctx.chat!.id);
    session.userId = userId;
    session.step = "await_relay_email";
    session.relayEmail = undefined;

    await ctx.reply("Send your Amazon Relay login email (one message, just the email).");
  });

  bot.command("2fa", async (ctx) => {
    const code = ctx.match?.trim();
    const chatId = String(ctx.chat!.id);

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
        `This Telegram chat isn't linked yet.\n\nOpen ${PORTAL_URL} → tap Connect Telegram → press Start in Telegram.`,
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

    const session = getSession(ctx.chat!.id);
    if (!session.step || !session.userId) return await next();

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
        clearSession(ctx.chat!.id);

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
        clearSession(ctx.chat!.id);
        await ctx.reply("Could not save credentials. Run /connect_relay to try again.");
      }
      return;
    }

    return await next();
  });
}
