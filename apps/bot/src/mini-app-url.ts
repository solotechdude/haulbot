import { resolveStartSearchMiniAppUrl } from "@haulbot/shared";

export function startSearchMiniAppUrl(): string | null {
  return resolveStartSearchMiniAppUrl({
    websiteUrl: process.env.WEBSITE_URL,
    miniAppUrlOverride: process.env.TELEGRAM_MINI_APP_URL,
  });
}
