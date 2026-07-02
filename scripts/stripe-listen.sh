#!/usr/bin/env bash
# Forward Stripe webhook events to local backend.
# Uses native `stripe` CLI if installed; otherwise Docker (stripe/stripe-cli).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.development.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.development.local
  set +a
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-8080}"
FORWARD_URL="localhost:${PORT}/v1/webhooks/stripe"
KEY="${STRIPE_SECRET_KEY:-${STRIPE_API_KEY:-}}"

if command -v stripe >/dev/null 2>&1; then
  echo "[stripe] Using local Stripe CLI → http://${FORWARD_URL}"
  exec stripe listen --forward-to "${FORWARD_URL}"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Stripe CLI not found. Install it:"
  echo "  macOS:  brew install stripe/stripe-cli/stripe"
  echo "  other:  https://stripe.com/docs/stripe-cli#install"
  exit 127
fi

if [[ -z "${KEY}" ]]; then
  echo "Set STRIPE_SECRET_KEY in .env.development.local"
  exit 1
fi

echo "[stripe] Using Docker stripe/stripe-cli → http://${FORWARD_URL}"
echo "[stripe] Copy whsec_... from output into STRIPE_WEBHOOK_SECRET"

TTY=()
if [[ -t 0 ]]; then
  TTY=(-it)
fi

exec docker run --rm "${TTY[@]}" \
  -e STRIPE_API_KEY="${KEY}" \
  stripe/stripe-cli:latest \
  listen --forward-to "host.docker.internal:${PORT}/v1/webhooks/stripe"
