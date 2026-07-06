#!/usr/bin/env python3
"""Merge .do/env.production.local.yaml + .do/app.yaml → .do/app.deploy.yaml (gitignored)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_YAML = ROOT / ".do" / "app.yaml"
SECRETS_YAML = ROOT / ".do" / "env.production.local.yaml"
OUT_YAML = ROOT / ".do" / "app.deploy.yaml"
ENV_FILE = ROOT / ".env"

SECRET_KEYS = [
    "MONGODB_URI",
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

REQUIRED_KEYS = [
    "MONGODB_URI",
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
    "RESEND_API_KEY",
]


def load_dotenv(path: Path) -> dict[str, str]:
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


def load_secrets_yaml(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(
            f"Missing {path.relative_to(ROOT)} — copy .do/env.production.local.yaml.example "
            "and fill every secret before deploy."
        )

    secrets: dict[str, str] = {}
    in_secrets = False
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or not stripped:
            continue
        if stripped == "secrets:":
            in_secrets = True
            continue
        if not in_secrets:
            continue
        if ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        secrets[key] = value
    return secrets


def merge_env(secrets: dict[str, str], dotenv: dict[str, str]) -> dict[str, str]:
    env = {**dotenv, **secrets}

    publishable = env.get("STRIPE_PUBLISHABLE_KEY") or env.get("VITE_STRIPE_PUBLISHABLE_KEY")
    if publishable:
        env["STRIPE_PUBLISHABLE_KEY"] = publishable
        env["VITE_STRIPE_PUBLISHABLE_KEY"] = publishable

    missing = [k for k in REQUIRED_KEYS if not env.get(k)]
    if missing:
        raise SystemExit(f"Missing required secrets: {', '.join(missing)}")

    unset = [k for k in SECRET_KEYS if k not in env or not env[k]]
    if unset:
        raise SystemExit(f"Every secret in app.yaml must have a value in env.production.local.yaml: {', '.join(unset)}")

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

        value = env[key]
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
    import subprocess

    env = merge_env(load_secrets_yaml(SECRETS_YAML), load_dotenv(ENV_FILE))
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
