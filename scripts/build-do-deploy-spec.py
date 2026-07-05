#!/usr/bin/env python3
"""Merge .env + generated secrets into .do/app.yaml → .do/app.deploy.yaml (gitignored)."""

from __future__ import annotations

import re
import secrets
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_YAML = ROOT / ".do" / "app.yaml"
OUT_YAML = ROOT / ".do" / "app.deploy.yaml"
ENV_FILE = ROOT / ".env"

SECRET_KEYS = [
    "SESSION_SECRET",
    "ADMIN_TOKEN",
    "DISPATCHER_SERVICE_TOKEN",
    "EXTENSION_SERVICE_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
    "STRIPE_PUBLISHABLE_KEY",
    "VITE_STRIPE_PUBLISHABLE_KEY",
    "RESEND_API_KEY",
    "ANALYTICS_ENGINE_URL",
    "ANALYTICS_ENGINE_TOKEN",
    "BRIEFING_ENABLED",
    "VAULT_ADDR",
    "VAULT_TOKEN",
    "PROVISIONER",
    "WSW_BROWSER_SETTINGS_ARN",
    "WSW_NETWORK_SETTINGS_ARN",
    "WSW_USER_SETTINGS_ARN",
]


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip()
    return out


def ensure_secrets(env: dict[str, str]) -> dict[str, str]:
    generated: list[str] = []

    def token(n: int = 32) -> str:
        return secrets.token_hex(n)

    for key in (
        "SESSION_SECRET",
        "ADMIN_TOKEN",
        "EXTENSION_SERVICE_TOKEN",
        "TELEGRAM_WEBHOOK_SECRET",
        "DISPATCHER_SERVICE_TOKEN",
    ):
        if not env.get(key):
            env[key] = token()
            generated.append(key)

    publishable = env.get("STRIPE_PUBLISHABLE_KEY") or env.get("VITE_STRIPE_PUBLISHABLE_KEY")
    if publishable:
        env["STRIPE_PUBLISHABLE_KEY"] = publishable
        env["VITE_STRIPE_PUBLISHABLE_KEY"] = publishable

    if generated:
        print("Generated:", ", ".join(generated))

    missing = [k for k in SECRET_KEYS if not env.get(k)]
    if missing:
        print("Empty (add in DO dashboard if needed):", ", ".join(missing))

    return env


def inject_secrets(spec: str, env: dict[str, str]) -> str:
    lines = spec.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"(\s*)- key: (\w+)\s*$", line)
        if not m:
            out.append(line)
            i += 1
            continue

        indent, key = m.group(1), m.group(2)
        if key not in SECRET_KEYS:
            out.append(line)
            i += 1
            continue

        # Collect env block
        block = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if re.match(r"\s*- key:", nxt):
                break
            if nxt.strip() and not nxt.startswith(indent + " "):
                break
            block.append(nxt)
            i += 1

        value = env.get(key, "")
        if not value:
            out.extend(block)
            continue

        scope = "RUN_TIME"
        for b in block:
            if "scope:" in b:
                scope = b.split("scope:", 1)[1].strip()
        out.append(f"{indent}- key: {key}")
        out.append(f"{indent}  scope: {scope}")
        out.append(f"{indent}  type: SECRET")
        out.append(f'{indent}  value: "{value}"')

    return "\n".join(out) + "\n"


def main() -> None:
    env = ensure_secrets(load_env(ENV_FILE))
    OUT_YAML.write_text(inject_secrets(APP_YAML.read_text(), env))
    print(f"Wrote {OUT_YAML.relative_to(ROOT)}")

    result = subprocess.run(
        ["doctl", "apps", "spec", "validate", str(OUT_YAML)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr or result.stdout)
    print("Spec validated.")


if __name__ == "__main__":
    main()
