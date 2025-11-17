#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/common.sh"

require_cmd jq
require_cmd curl

CUSTOMER_INSTANCE_URL="${CUSTOMER_INSTANCE_URL:-}"
CUSTOMER_API_TOKEN="${CUSTOMER_API_TOKEN:-}"
PLATFORM="${PLATFORM:-}"        # android | ios
BUILD_PROFILE="${BUILD_PROFILE:-development}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-}"
GITHUB_RUN_ID="${GITHUB_RUN_ID:-}"
GITHUB_RUN_NUMBER="${GITHUB_RUN_NUMBER:-}"
GITHUB_SHA="${GITHUB_SHA:-}"
GITHUB_REF_NAME="${GITHUB_REF_NAME:-}"
BUILD_ID="${BUILD_ID:-}"        # pass in from previous step or extract_artifact
ARTIFACT_URL="${ARTIFACT_URL:-}" # pass in from previous step or extract_artifact
STATUS="${STATUS:-}"            # optional override; default inferred below

if [ -z "$CUSTOMER_INSTANCE_URL" ] || [ -z "$CUSTOMER_API_TOKEN" ]; then
  log "Customer webhook secrets not set; skipping notification."
  exit 0
fi

if [ -z "$STATUS" ]; then
  # If we got an artifact URL, this build finished successfully
  if [ -n "$ARTIFACT_URL" ]; then
    STATUS="finished"
  else
    STATUS="pending"
  fi
fi

PAYLOAD=$(jq -n \
  --arg build_id "$BUILD_ID" \
  --arg platform "$PLATFORM" \
  --arg profile "$BUILD_PROFILE" \
  --arg bucket "$S3_BUCKET" \
  --arg prefix "$S3_PREFIX" \
  --arg workflow_run_id "$GITHUB_RUN_ID" \
  --arg workflow_run_number "$GITHUB_RUN_NUMBER" \
  --arg commit "$GITHUB_SHA" \
  --arg branch "$GITHUB_REF_NAME" \
  --arg artifact_url "$ARTIFACT_URL" \
  --arg status "$STATUS" \
  '{build_id: $build_id, platform: $platform, profile: $profile, status: $status, s3_bucket: $bucket, s3_prefix: $prefix, workflow_run_id: $workflow_run_id, workflow_run_number: $workflow_run_number, artifact_url: $artifact_url, commit: $commit, branch: $branch}')

# Write for debug
echo "$PAYLOAD" > /tmp/webhook_payload.json || true

log "DEBUG: GITHUB_RUN_ID=$GITHUB_RUN_ID, GITHUB_RUN_NUMBER=$GITHUB_RUN_NUMBER"
log "DEBUG: Final webhook payload (compact):"
if command -v jq >/dev/null 2>&1; then jq -c . /tmp/webhook_payload.json || cat /tmp/webhook_payload.json; else cat /tmp/webhook_payload.json; fi

HTTP=$(curl -s -o /tmp/webhook_resp.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token ${CUSTOMER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "${CUSTOMER_INSTANCE_URL}/api/method/tm_mobile_build.api.webhook.receive_eas_build" ) || true

log "Webhook HTTP status: $HTTP"
sed -n '1,200p' /tmp/webhook_resp.json || true

if [ "${HTTP:0:1}" != "2" ]; then
  log "Webhook returned non-2xx status ($HTTP)."
  exit 1
fi
