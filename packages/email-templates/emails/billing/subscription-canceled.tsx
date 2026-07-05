import { Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../../components/EmailButton";
import { EmailHeading } from "../../components/EmailHeading";
import { EmailLayout } from "../../components/EmailLayout";
import { EmailText } from "../../components/EmailText";
import { theme } from "../../theme";

export interface SubscriptionCanceledEmailProps {
  /** URL to resubscribe (marketing/checkout). */
  resubscribeUrl: string;
  /** Optional human date access ends, e.g. "Aug 3, 2026". Omit if access ended immediately. */
  accessEndsOn?: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export default function SubscriptionCanceledEmail({
  resubscribeUrl,
  accessEndsOn,
  driverEmail,
}: SubscriptionCanceledEmailProps) {
  return (
    <EmailLayout preview="Your Haulbot subscription has been canceled.">
      <EmailHeading>Your subscription is canceled</EmailHeading>

      <EmailText>
        {accessEndsOn
          ? `Your Haulbot subscription is canceled. You keep access until ${accessEndsOn}, after which your dedicated dispatch environment is shut down.`
          : "Your Haulbot subscription is canceled and your dedicated dispatch environment has been shut down."}
      </EmailText>

      <EmailText>
        Thanks for riding with us. If you come back, we'll provision a fresh environment and you can
        pick up right where you left off.
      </EmailText>

      <Section style={{ paddingTop: theme.space[4] }}>
        <EmailButton href={resubscribeUrl}>Resubscribe</EmailButton>
      </Section>

      {driverEmail ? (
        <EmailText tone="subtle" size="small">
          This message was sent to {driverEmail}.
        </EmailText>
      ) : null}
    </EmailLayout>
  );
}

SubscriptionCanceledEmail.PreviewProps = {
  resubscribeUrl: "https://haulbot.online/#pricing",
  accessEndsOn: "Aug 3, 2026",
  driverEmail: "driver@example.com",
} satisfies SubscriptionCanceledEmailProps;
