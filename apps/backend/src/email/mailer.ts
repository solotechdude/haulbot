import { Resend } from "resend";
import { fillMagicLinkEmail } from "@haulbot/email-templates/send";

const DEFAULT_FROM = "Haulbot <login@haulbot.online>";

export async function sendSignInEmail(to: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.log("[email] RESEND_API_KEY unset — sign-in link for %s: %s", to, url);
    return;
  }

  const { html, text } = fillMagicLinkEmail(url, to);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "Your Haulbot sign-in link",
    text,
    html,
  });

  if (error) {
    console.error("[email] Resend rejected sign-in email for %s:", to, error);
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }

  console.log("[email] sign-in email sent to %s (id=%s)", to, data?.id ?? "unknown");
}
