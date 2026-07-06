import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAGIC_LINK_EMAIL_PLACEHOLDER,
  MAGIC_LINK_PORTAL_PLACEHOLDER,
} from "./placeholders";

const templateDir = join(import.meta.dir, "../out");

let htmlTemplate: string | undefined;
let textTemplate: string | undefined;

function loadTemplates(): void {
  if (htmlTemplate && textTemplate) return;

  const htmlPath = join(templateDir, "magic-link.html");
  const textPath = join(templateDir, "magic-link.txt");

  try {
    htmlTemplate = readFileSync(htmlPath, "utf8");
    textTemplate = readFileSync(textPath, "utf8");
  } catch {
    throw new Error(
      "Magic-link send templates are missing. Run: bun run --filter @haulbot/email-templates export:magic-link",
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function substitute(template: string, portalUrl: string, driverEmail: string, escape: boolean): string {
  const url = escape ? escapeHtml(portalUrl) : portalUrl;
  const email = escape ? escapeHtml(driverEmail) : driverEmail;
  return template
    .replaceAll(MAGIC_LINK_PORTAL_PLACEHOLDER, url)
    .replaceAll(MAGIC_LINK_EMAIL_PLACEHOLDER, email);
}

export function fillMagicLinkEmail(
  portalUrl: string,
  driverEmail: string,
): { html: string; text: string } {
  loadTemplates();
  return {
    html: substitute(htmlTemplate!, portalUrl, driverEmail, true),
    text: substitute(textTemplate!, portalUrl, driverEmail, false),
  };
}
