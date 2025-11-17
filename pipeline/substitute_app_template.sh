#!/usr/bin/env bash
set -euo pipefail

# Inputs via env:
# APP_CONFIG_JSON (string JSON)
# APP_CONFIG_JSON_BASE64 (base64 of the JSON, preferred for long inputs)
# APP_CONFIG_JSON_FILE (path to JSON file in repo/workspace)
# app.template.json must exist in CWD

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/common.sh"

require_cmd jq
require_cmd sed

if [ ! -f app.template.json ]; then
  log "ERROR: app.template.json not found in $(pwd)"
  exit 1
fi

log "Parsing app configuration from JSON input..."
# Priority: BASE64 > FILE > RAW STRING > default {}
if [ -n "${APP_CONFIG_JSON_BASE64:-}" ]; then
  log "Decoding APP_CONFIG_JSON_BASE64 into config.json"
  echo "$APP_CONFIG_JSON_BASE64" | base64 -d > config.json || { log "ERROR: Failed to decode APP_CONFIG_JSON_BASE64"; exit 1; }
elif [ -n "${APP_CONFIG_JSON_FILE:-}" ] && [ -f "$APP_CONFIG_JSON_FILE" ]; then
  log "Using APP_CONFIG_JSON_FILE: $APP_CONFIG_JSON_FILE"
  cp "$APP_CONFIG_JSON_FILE" config.json
elif [ -f "config/app_config.json" ]; then
  log "Using default file at config/app_config.json"
  cp "config/app_config.json" config.json
else
  log "Using APP_CONFIG_JSON raw string"
  printf '%s' "${APP_CONFIG_JSON:-{}}" > config.json
fi

# Validate JSON early to avoid a cascade of jq parse errors later
if ! jq -e . config.json >/dev/null 2>&1; then
  log "WARNING: APP_CONFIG_JSON is not valid JSON (see below). Attempting simple repair..."
  sed -n '1,200p' config.json || true
  # Try trimming a single trailing '}' once or twice (common copy/paste error)
  repaired=0
  for i in 1 2; do
    last_char=$(tail -c 1 config.json 2>/dev/null || echo "")
    if [ "$last_char" = "}" ]; then
      tmp_content=$(head -c -1 config.json 2>/dev/null || echo "")
      printf '%s' "$tmp_content" > config.json
      if jq -e . config.json >/dev/null 2>&1; then
        repaired=1; break
      fi
    else
      break
    fi
  done
  if [ "$repaired" -ne 1 ]; then
    log "Proceeding in best-effort mode with defaults for unparsable fields."
  else
    log "JSON repaired successfully."
  fi
fi

cat config.json

# Export all config values as environment variables
export APP_NAME=$(jq -r '.APP_NAME // ""' config.json 2>/dev/null || echo "")
export APP_SLUG=$(jq -r '.APP_SLUG // ""' config.json 2>/dev/null || echo "")
export APP_VERSION_STRING=$(jq -r '.APP_VERSION_STRING // ""' config.json 2>/dev/null || echo "")
export APP_SCHEME=$(jq -r '.APP_SCHEME // ""' config.json 2>/dev/null || echo "")
export APP_SCHEME_PREFIX=$(jq -r '.APP_SCHEME_PREFIX // ""' config.json 2>/dev/null || echo "")
export PRIMARY_COLOR=$(jq -r '.PRIMARY_COLOR // ""' config.json 2>/dev/null || echo "")
export ICON_PATH=$(jq -r '.ICON_PATH // ""' config.json 2>/dev/null || echo "")
export SPLASH_IMAGE_PATH=$(jq -r '.SPLASH_IMAGE_PATH // ""' config.json 2>/dev/null || echo "")
export SPLASH_BG_COLOR=$(jq -r '.SPLASH_BG_COLOR // ""' config.json 2>/dev/null || echo "")
export SPLASH_BG_COLOR_DARK=$(jq -r '.SPLASH_BG_COLOR_DARK // ""' config.json 2>/dev/null || echo "")
export CUSTOMER_URL=$(jq -r '.CUSTOMER_URL // ""' config.json 2>/dev/null || echo "")
export CUSTOMER_HOST=$(jq -r '.CUSTOMER_HOST // ""' config.json 2>/dev/null || echo "")
export ENVIRONMENT=$(jq -r '.ENVIRONMENT // ""' config.json 2>/dev/null || echo "")
export EAS_PROJECT_ID=$(jq -r '.EAS_PROJECT_ID // ""' config.json 2>/dev/null || echo "")
export EXPO_OWNER=$(jq -r '.EXPO_OWNER // ""' config.json 2>/dev/null || echo "")
export IOS_BUNDLE_IDENTIFIER=$(jq -r '.IOS_BUNDLE_IDENTIFIER // ""' config.json 2>/dev/null || echo "")
export IOS_BUILD_NUMBER_STRING=$(jq -r '.IOS_BUILD_NUMBER_STRING // ""' config.json 2>/dev/null || echo "")
export IOS_ASSOCIATED_DOMAIN=$(jq -r '.IOS_ASSOCIATED_DOMAIN // ""' config.json 2>/dev/null || echo "")
export ANDROID_PACKAGE_NAME=$(jq -r '.ANDROID_PACKAGE_NAME // ""' config.json 2>/dev/null || echo "")
export ANDROID_VERSION_CODE_INT=$(jq -r '.ANDROID_VERSION_CODE_INT // ""' config.json 2>/dev/null || echo "")
export ANDROID_ADAPTIVE_BG_COLOR=$(jq -r '.ANDROID_ADAPTIVE_BG_COLOR // ""' config.json 2>/dev/null || echo "")
export ANDROID_FG_PATH=$(jq -r '.ANDROID_FG_PATH // ""' config.json 2>/dev/null || echo "")
export ANDROID_BG_PATH=$(jq -r '.ANDROID_BG_PATH // ""' config.json 2>/dev/null || echo "")
export ANDROID_MONO_PATH=$(jq -r '.ANDROID_MONO_PATH // ""' config.json 2>/dev/null || echo "")
export FAVICON_PATH=$(jq -r '.FAVICON_PATH // ""' config.json 2>/dev/null || echo "")
export FEATURE_FLAGS_JSON_OBJECT=$(jq -c '(.FEATURE_FLAGS_JSON_OBJECT // {}) | (if type=="string" then (try fromjson catch {} ) else . end)' config.json 2>/dev/null || echo '{}')
export WORKSPACE_PAGES_JSON_ARRAY=$(jq -c '(.WORKSPACE_PAGES_JSON_ARRAY // []) | (if type=="string" then (try fromjson catch [] ) else . end)' config.json 2>/dev/null || echo '[]')
export DEEP_LINK_PREFIXES=$(jq -c '(.DEEP_LINK_PREFIXES // []) | (if type=="string" then (try fromjson catch [] ) else . end)' config.json 2>/dev/null || echo '[]')
export ALLOWED_ORIGINS=$(jq -c '(.ALLOWED_ORIGINS // []) | (if type=="string" then (try fromjson catch [] ) else . end)' config.json 2>/dev/null || echo '[]')

log "Replacing placeholders in app.template.json..."
cp app.template.json app.template.json.backup

sed -i "s|__APP_NAME__|${APP_NAME}|g" app.template.json
sed -i "s|__APP_SLUG__|${APP_SLUG}|g" app.template.json
sed -i "s|__APP_VERSION_STRING__|${APP_VERSION_STRING}|g" app.template.json
sed -i "s|__APP_SCHEME__|${APP_SCHEME}|g" app.template.json
sed -i "s|__APP_SCHEME_PREFIX__|${APP_SCHEME_PREFIX}|g" app.template.json
sed -i "s|__PRIMARY_COLOR__|${PRIMARY_COLOR}|g" app.template.json
sed -i "s|__ICON_PATH__|${ICON_PATH}|g" app.template.json
sed -i "s|__SPLASH_IMAGE_PATH__|${SPLASH_IMAGE_PATH}|g" app.template.json
sed -i "s|__SPLASH_BG_COLOR__|${SPLASH_BG_COLOR}|g" app.template.json
sed -i "s|__SPLASH_BG_COLOR_DARK__|${SPLASH_BG_COLOR_DARK}|g" app.template.json
sed -i "s|__CUSTOMER_URL__|${CUSTOMER_URL}|g" app.template.json
sed -i "s|__CUSTOMER_HOST__|${CUSTOMER_HOST}|g" app.template.json
sed -i "s|__ENVIRONMENT__|${ENVIRONMENT}|g" app.template.json
sed -i "s|__EAS_PROJECT_ID__|${EAS_PROJECT_ID}|g" app.template.json
sed -i "s|__EXPO_OWNER__|${EXPO_OWNER}|g" app.template.json
sed -i "s|__IOS_BUNDLE_IDENTIFIER__|${IOS_BUNDLE_IDENTIFIER}|g" app.template.json
sed -i "s|__IOS_BUILD_NUMBER_STRING__|${IOS_BUILD_NUMBER_STRING}|g" app.template.json
sed -i "s|__IOS_ASSOCIATED_DOMAIN__|${IOS_ASSOCIATED_DOMAIN}|g" app.template.json
sed -i "s|__ANDROID_PACKAGE_NAME__|${ANDROID_PACKAGE_NAME}|g" app.template.json
sed -i "s|__ANDROID_VERSION_CODE_INT__|${ANDROID_VERSION_CODE_INT}|g" app.template.json
sed -i "s|__ANDROID_ADAPTIVE_BG_COLOR__|${ANDROID_ADAPTIVE_BG_COLOR}|g" app.template.json
sed -i "s|__ANDROID_FG_PATH__|${ANDROID_FG_PATH}|g" app.template.json
sed -i "s|__ANDROID_BG_PATH__|${ANDROID_BG_PATH}|g" app.template.json
sed -i "s|__ANDROID_MONO_PATH__|${ANDROID_MONO_PATH}|g" app.template.json
sed -i "s|__FAVICON_PATH__|${FAVICON_PATH}|g" app.template.json
# Replace quoted JSON-object placeholder (including surrounding quotes) with compact JSON
sed -i "s|\"__FEATURE_FLAGS_JSON_OBJECT__\"|${FEATURE_FLAGS_JSON_OBJECT}|g" app.template.json
# Replace array-wrapped placeholder ["__WORKSPACE_PAGES_JSON_ARRAY__"] with compact JSON array
sed -i "s|\[\"__WORKSPACE_PAGES_JSON_ARRAY__\"\]|${WORKSPACE_PAGES_JSON_ARRAY}|g" app.template.json
sed -i "s|__DEEP_LINK_PREFIXES__|${DEEP_LINK_PREFIXES}|g" app.template.json
sed -i "s|__ALLOWED_ORIGINS__|${ALLOWED_ORIGINS}|g" app.template.json

log "Renaming app.template.json to app.json..."
mv app.template.json app.json

# Validate generated JSON
if ! jq -e . app.json >/dev/null 2>&1; then
  log "ERROR: Generated app.json is not valid JSON. Dumping file for debug:"
  cat app.json || true
  exit 1
fi

log "Generated app.json content:"
cat app.json

# Expose CUSTOMER_INSTANCE_URL to later steps
if [ -n "${CUSTOMER_URL:-}" ]; then
  echo "CUSTOMER_INSTANCE_URL=${CUSTOMER_URL}" >> "$GITHUB_ENV"
fi

log "✓ Substitution complete"
