import { Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../components/EmailButton";
import { EmailHeading } from "../components/EmailHeading";
import { EmailLayout } from "../components/EmailLayout";
import { EmailText } from "../components/EmailText";
import { theme } from "../theme";

export interface EnvironmentReadyEmailProps {
  /** Magic-link URL to the /solo subscriber portal (already contains the token). */
  portalUrl: string;
  /** Optional recipient email, shown so the driver knows which account this is. */
  driverEmail?: string;
}

export default function EnvironmentReadyEmail({
  portalUrl,
  driverEmail,
}: EnvironmentReadyEmailProps) {
  return (
    <EmailLayout preview="Your dedicated dispatch environment is ready — sign in to finish setup.">
      <EmailHeading>Your environment is ready</EmailHeading>

      <EmailText>
        Your dedicated dispatch environment is provisioned and standing by. Sign in to your portal to
        finish setup and connect Telegram — that's where you'll set goals and get booking updates.
      </EmailText>

      <Section style={{ paddingTop: theme.space[4] }}>
        <EmailButton href={portalUrl}>Sign in to your portal</EmailButton>
      </Section>

      <EmailText tone="subtle" size="small">
        This sign-in link is unique to you and expires soon. If the button doesn't work, copy and paste
        this URL into your browser:
        <br />
        <span style={{ color: theme.color.muted, wordBreak: "break-all" }}>{portalUrl}</span>
      </EmailText>

      {driverEmail ? (
        <EmailText tone="subtle" size="small">
          This message was sent to {driverEmail}.
        </EmailText>
      ) : null}
    </EmailLayout>
  );
}

EnvironmentReadyEmail.PreviewProps = {
  portalUrl: "https://haulbot.online/solo?token=preview-magic-link-token",
  driverEmail: "driver@example.com",
} satisfies EnvironmentReadyEmailProps;
