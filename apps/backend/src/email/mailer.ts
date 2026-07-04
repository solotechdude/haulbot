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

  const text =
    `Click to sign in to your Haulbot account:\n\n${url}\n\n` +
    `This link expires in 7 days. If you didn't request it, you can ignore this email.`;

  const html =
    `<p>Click to sign in to your Haulbot account:</p>` +
    `<p><a href="${url}">${url}</a></p>` +
    `<p>This link expires in 7 days. If you didn't request it, you can ignore this email.</p>`;

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
