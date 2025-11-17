#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[tm_mobile_build] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: required command '$1' not found"
    exit 1
  fi
}

jq_get() {
  local jq_expr="$1"
  local file="$2"
  jq -r "$jq_expr" "$file"
}

