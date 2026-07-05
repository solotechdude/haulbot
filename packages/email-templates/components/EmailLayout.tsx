import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Row,
  Section,
} from "@react-email/components";
import * as React from "react";
import { brand, theme } from "../theme";
import { EmailFooter } from "./EmailFooter";

/**
 * Shared document shell for every Haulbot email.
 * Owns the <head>, brand wordmark, body/container styling, and footer so
 * individual templates only describe their content.
 */
export function EmailLayout({
  preview,
  children,
  footer,
}: {
  preview: string;
  children: React.ReactNode;
  /** Footer slot. Defaults to the transactional footer; marketing emails pass a compliant one. */
  footer?: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: theme.color.bg,
          margin: 0,
          padding: `${theme.space[5]} 0`,
          fontFamily: theme.font.sans,
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: "520px",
            margin: "0 auto",
            backgroundColor: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.lg,
            padding: theme.space[5],
          }}
        >
          <Section>
            <Row>
              <Column
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: theme.color.accent,
                  borderRadius: theme.radius.base,
                  textAlign: "center",
                  verticalAlign: "middle",
                  fontFamily: theme.font.sans,
                  fontSize: "20px",
                  fontWeight: 700,
                  lineHeight: "36px",
                  letterSpacing: "-0.02em",
                  color: theme.color.accentText,
                }}
              >
                {brand.wordmark.charAt(0)}
              </Column>
              <Column style={{ paddingLeft: "12px", verticalAlign: "middle" }}>
                <span
                  style={{
                    fontFamily: theme.font.sans,
                    fontSize: "20px",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: theme.color.text,
                  }}
                >
                  {brand.wordmark}
                  <span style={{ color: theme.color.accent }}>{brand.wordmarkAccent}</span>
                </span>
              </Column>
            </Row>
          </Section>
          <Section style={{ paddingTop: theme.space[4] }}>{children}</Section>
          {footer ?? <EmailFooter />}
        </Container>
      </Body>
    </Html>
  );
}
