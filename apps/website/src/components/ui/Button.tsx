import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", children, className, ...props }: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, className].filter(Boolean).join(" ");
  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
