#!/usr/bin/env bash
# One-time setup for Google Analytics MCP in Cursor.
# Docs: https://github.com/googleanalytics/google-analytics-mcp

set -euo pipefail

GCLOUD="${GCLOUD:-gcloud}"
ADC_FILE="${HOME}/.config/gcloud/application_default_credentials.json"
OAUTH_CLIENT_FILE="${GOOGLE_OAUTH_CLIENT_FILE:-${HOME}/.config/haulbot/google-analytics-oauth-client.json}"

echo "==> Google Analytics MCP setup"
echo "Use the Google account that has access to your Haulbot GA4 property."
echo

if ! command -v uv >/dev/null 2>&1; then
  echo "Install uv first: https://docs.astral.sh/uv/"
  exit 1
fi

echo "==> Installing analytics-mcp"
uv tool install analytics-mcp

echo "==> gcloud login (browser opens)"
"${GCLOUD}" auth login

ACTIVE_ACCOUNT="$("${GCLOUD}" config get-value account 2>/dev/null)"
echo "Active account: ${ACTIVE_ACCOUNT}"

PROJECT_ID="${GOOGLE_PROJECT_ID:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID="$("${GCLOUD}" projects list --format='value(projectId)' --limit=1 2>/dev/null || true)"
fi

if [[ -z "${PROJECT_ID}" ]]; then
  echo "No GCP project found. Create one at https://console.cloud.google.com/projectcreate"
  exit 1
fi

echo "==> Using GCP project: ${PROJECT_ID}"
"${GCLOUD}" config set project "${PROJECT_ID}"

echo "==> Enabling Analytics APIs"
"${GCLOUD}" services enable analyticsadmin.googleapis.com analyticsdata.googleapis.com

if [[ ! -f "${OAUTH_CLIENT_FILE}" ]]; then
  echo
  echo "OAuth client JSON not found at:"
  echo "  ${OAUTH_CLIENT_FILE}"
  echo
  echo "Google blocks the default gcloud app for Analytics scopes (\"This app is blocked\")."
  echo "Create your own Desktop OAuth client once:"
  echo
  echo "  1. https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
  echo "  2. OAuth consent screen → External → Testing → add ${ACTIVE_ACCOUNT} as Test user"
  echo "  3. Credentials → Create credentials → OAuth client ID → Desktop app"
  echo "  4. Download JSON → save as:"
  echo "       ${OAUTH_CLIENT_FILE}"
  echo
  echo "Then re-run this script."
  exit 1
fi

mkdir -p "$(dirname "${OAUTH_CLIENT_FILE}")"

echo "==> Application Default Credentials (browser opens)"
echo "Using OAuth client: ${OAUTH_CLIENT_FILE}"
"${GCLOUD}" auth application-default login \
  --client-id-file="${OAUTH_CLIENT_FILE}" \
  --scopes="https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform"

if [[ ! -f "${ADC_FILE}" ]]; then
  echo "Expected ADC at ${ADC_FILE} but file is missing."
  exit 1
fi

echo
echo "Setup complete."
echo "  Account:  ${ACTIVE_ACCOUNT}"
echo "  Project:  ${PROJECT_ID}"
echo "  ADC:      ${ADC_FILE}"
echo
echo "Ensure ~/.cursor/mcp.json has GOOGLE_PROJECT_ID=${PROJECT_ID}"
echo "Restart Cursor, then ask: \"List my Google Analytics properties\""
