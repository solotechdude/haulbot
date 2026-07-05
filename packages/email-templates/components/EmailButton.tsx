import { Button } from "@react-email/components";
import * as React from "react";
import { theme } from "../theme";

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: theme.color.accent,
        color: theme.color.accentText,
        fontFamily: theme.font.sans,
        fontSize: "15px",
        fontWeight: 600,
        lineHeight: "20px",
        textDecoration: "none",
        padding: "12px 22px",
        borderRadius: theme.radius.base,
      }}
    >
      {children}
    </Button>
  );
}
