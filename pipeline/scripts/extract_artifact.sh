#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Input: eas-out.json (required), optional eas-view.json
# Output: writes artifact info to $GITHUB_OUTPUT (ARTIFACT_URL, BUILD_ID)

require_cmd jq

ARTIFACT_URL=""
BUILD_ID=""

if [ -f eas-out.json ]; then
  TYPE=$(jq -r 'type' eas-out.json || echo "null")
  if [ "$TYPE" = "array" ]; then
    LEN=$(jq 'length' eas-out.json || echo 0)
    i=0
    while [ "$i" -lt "$LEN" ]; do
      CAND=$(jq -r ".[$i].artifacts.buildUrl // .[$i].artifacts.url // (.[$i].artifacts[0].url // empty)" eas-out.json 2>/dev/null || true)
      if [ -n "$CAND" ] && [ "$CAND" != "null" ]; then
        ARTIFACT_URL="$CAND"; break
      fi
      i=$((i+1))
    done
    BUILD_ID=$(jq -r '.[0].id // empty' eas-out.json || echo "")
  else
    ARTIFACT_URL=$(jq -r '.artifacts.buildUrl // .artifacts.url // .artifacts[0].url // empty' eas-out.json 2>/dev/null || true)
    BUILD_ID=$(jq -r '.id // empty' eas-out.json || echo "")
  fi
fi

if { [ -z "$ARTIFACT_URL" ] || [ "$ARTIFACT_URL" = "null" ]; } && [ -f eas-view.json ]; then
  ARTIFACT_URL=$(jq -r 'if type=="array" then (.[0].artifacts.buildUrl // .[0].artifacts.url // .[0].artifacts[0].url) else (.artifacts.buildUrl // .artifacts.url // .artifacts[0].url) end // empty' eas-view.json || echo "")
fi

log "Discovered artifact_url='$ARTIFACT_URL' build_id='$BUILD_ID'"

{
  echo "ARTIFACT_URL=$ARTIFACT_URL"
  echo "BUILD_ID=$BUILD_ID"
} >> "$GITHUB_OUTPUT"

