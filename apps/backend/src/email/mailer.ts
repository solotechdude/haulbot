import { renderMagicLinkEmail } from "@haulbot/email-templates";
import { Resend } from "resend";

const DEFAULT_FROM = "Haulbot <login@haulbot.online>";

let resendClient: Resend | null = null;

function getResend(apiKey: string): Resend {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendSignInEmail(to: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.log("[email] sign-in link for %s: %s", to, url);
    return;
  }

  const { html, text } = await renderMagicLinkEmail({ portalUrl: url, driverEmail: to });

  try {
    const { error } = await getResend(apiKey).emails.send({
      from,
      to,
      subject: "Your Haulbot sign-in link",
      text,
      html,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return;
    }
  } catch (err) {
    console.error("[email] send failed:", err);
    return;
  }
}
