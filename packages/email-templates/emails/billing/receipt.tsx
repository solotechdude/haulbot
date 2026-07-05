import { Column, Row, Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../../components/EmailButton";
import { EmailHeading } from "../../components/EmailHeading";
import { EmailLayout } from "../../components/EmailLayout";
import { EmailText } from "../../components/EmailText";
import { theme } from "../../theme";

export interface ReceiptEmailProps {
  /** Formatted amount charged, e.g. "$149.00". */
  amount: string;
  /** Human date the payment was made, e.g. "Jul 3, 2026". */
  paidOn: string;
  /** Human date the current period ends / next charge, e.g. "Aug 3, 2026". */
  nextChargeOn?: string;
  /** Stripe-hosted invoice/receipt URL. */
  invoiceUrl?: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

const rowLabel = {
  margin: 0,
  fontFamily: theme.font.sans,
  fontSize: "13px",
  lineHeight: "22px",
  color: theme.color.subtle,
};

const rowValue = {
  margin: 0,
  fontFamily: theme.font.sans,
  fontSize: "13px",
  lineHeight: "22px",
  color: theme.color.text,
  textAlign: "right" as const,
  fontWeight: 600,
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ padding: `${theme.space[1]} 0` }}>
      <Column>
        <p style={rowLabel}>{label}</p>
      </Column>
      <Column>
        <p style={rowValue}>{value}</p>
      </Column>
    </Row>
  );
}

export default function ReceiptEmail({
  amount,
  paidOn,
  nextChargeOn,
  invoiceUrl,
  driverEmail,
}: ReceiptEmailProps) {
  return (
    <EmailLayout preview={`Payment received — ${amount} for Haulbot`}>
      <EmailHeading>Payment received</EmailHeading>

      <EmailText>
        Thanks — we've received your payment for Haulbot. Your dispatch environment stays
        active. Here are the details:
      </EmailText>

      <Section
        style={{
          marginTop: theme.space[4],
          padding: `${theme.space[2]} ${theme.space[3]}`,
          backgroundColor: theme.color.wash,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.base,
        }}
      >
        <DetailRow label="Amount" value={amount} />
        <DetailRow label="Paid on" value={paidOn} />
        {nextChargeOn ? <DetailRow label="Next charge" value={nextChargeOn} /> : null}
      </Section>

      {invoiceUrl ? (
        <Section style={{ paddingTop: theme.space[4] }}>
          <EmailButton href={invoiceUrl}>View receipt</EmailButton>
        </Section>
      ) : null}

      {driverEmail ? (
        <EmailText tone="subtle" size="small">
          This message was sent to {driverEmail}.
        </EmailText>
      ) : null}
    </EmailLayout>
  );
}

ReceiptEmail.PreviewProps = {
  amount: "$149.00",
  paidOn: "Jul 3, 2026",
  nextChargeOn: "Aug 3, 2026",
  invoiceUrl: "https://invoice.stripe.com/i/preview",
  driverEmail: "driver@example.com",
} satisfies ReceiptEmailProps;
