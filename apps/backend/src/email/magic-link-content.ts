/** Static magic-link email bodies — no React Email SSR at runtime. */

const ACCENT = "#0F766E";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function magicLinkText(portalUrl: string, driverEmail?: string): string {
  const recipient = driverEmail ? ` sent to ${driverEmail}` : "";
  return [
    "Sign in to Haulbot",
    "",
    "Use the link below to sign in to your subscriber portal. No password needed — this link signs you in securely.",
    "",
    portalUrl,
    "",
    "This link expires in 15 minutes and can only be used once.",
    "",
    `Didn't request this? You can safely ignore this email${recipient} — nobody can sign in without the link above.`,
    "",
    "Questions? support@haulbot.online",
  ].join("\n");
}

export function magicLinkHtml(portalUrl: string, driverEmail?: string): string {
  const safeUrl = escapeHtml(portalUrl);
  const recipient = driverEmail ? ` sent to ${escapeHtml(driverEmail)}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Haulbot sign-in link</title>
</head>
<body style="margin:0;padding:40px 0;background:#fafafa;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;padding:40px;">
          <tr>
            <td>
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
                <span style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;background:${ACCENT};color:#ffffff;border-radius:14px;margin-right:12px;">H</span>
                Haul<span style="color:${ACCENT};">bot</span>
              </p>
              <h1 style="margin:24px 0 0;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.02em;">Sign in to Haulbot</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:24px;color:#525252;">
                Use the button below to sign in to your subscriber portal. No password needed — this link signs you in securely.
              </p>
              <p style="margin:24px 0 0;">
                <a href="${safeUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:14px;">Sign in</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:22px;color:#737373;">
                This link expires in 15 minutes and can only be used once. If the button doesn't work, copy and paste this URL into your browser:<br />
                <span style="color:#525252;word-break:break-all;">${safeUrl}</span>
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:22px;color:#737373;">
                Didn't request this? You can safely ignore this email${recipient} — nobody can sign in without the link above.
              </p>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:40px 0 16px;" />
              <p style="margin:0;font-size:13px;line-height:20px;color:#737373;">
                Questions? Reach us at <a href="mailto:support@haulbot.online" style="color:#525252;">support@haulbot.online</a>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#737373;">Haulbot — AI dispatch for solo Amazon Relay owner-operators.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
