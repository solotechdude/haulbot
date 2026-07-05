import { Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../../components/EmailButton";
import { EmailHeading } from "../../components/EmailHeading";
import { EmailLayout } from "../../components/EmailLayout";
import { EmailText } from "../../components/EmailText";
import { theme } from "../../theme";

export interface PaymentFailedEmailProps {
  /** Stripe billing portal URL where the driver can update their payment method. */
  manageBillingUrl: string;
  /** Optional formatted amount due, e.g. "$149.00". */
  amountDue?: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export default function PaymentFailedEmail({
  manageBillingUrl,
  amountDue,
  driverEmail,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout preview="We couldn't process your Haulbot payment — update your card to keep dispatch running.">
      <EmailHeading>Your payment didn't go through</EmailHeading>

      <EmailText>
        We couldn't process your latest Haulbot payment{amountDue ? ` of ${amountDue}` : ""}. To
        keep your dispatch environment running without interruption, please update your payment method.
      </EmailText>

      <Section style={{ paddingTop: theme.space[4] }}>
        <EmailButton href={manageBillingUrl}>Update payment method</EmailButton>
      </Section>

      <EmailText tone="subtle" size="small">
        We'll retry the charge automatically over the next few days. If it keeps failing, your
        environment may be paused until billing is resolved.
      </EmailText>

      {driverEmail ? (
        <EmailText tone="subtle" size="small">
          This message was sent to {driverEmail}.
        </EmailText>
      ) : null}
    </EmailLayout>
  );
}

PaymentFailedEmail.PreviewProps = {
  manageBillingUrl: "https://billing.stripe.com/p/session/preview",
  amountDue: "$149.00",
  driverEmail: "driver@example.com",
} satisfies PaymentFailedEmailProps;
