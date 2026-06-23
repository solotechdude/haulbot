import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button className={`btn btn--${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}
