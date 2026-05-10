#!/usr/bin/env bash
set -euo pipefail

# EAS Build pre-install hook
#
# Restores Firebase native config files (google-services.json, GoogleService-Info.plist)
# from EAS Secrets at build time so they don't have to live in git.
#
# Required EAS Secrets (set once via `eas secret:create`):
#   GOOGLE_SERVICES_JSON_BASE64       — base64 of google-services.json
#   GOOGLE_SERVICE_INFO_PLIST_BASE64  — base64 of GoogleService-Info.plist
#
# Local builds are unaffected: if the file is already on disk, the hook leaves it alone.
# Local devs keep their copies untracked (see .gitignore).

restore_file () {
  local secret_var="$1"
  local out_path="$2"
  local secret_value="${!secret_var:-}"

  if [ -n "$secret_value" ]; then
    echo "$secret_value" | base64 -d > "$out_path"
    echo "[eas-pre-install] restored $out_path from \$$secret_var ($(wc -c < "$out_path") bytes)"
    return
  fi

  if [ -f "$out_path" ]; then
    echo "[eas-pre-install] $out_path already present locally — leaving alone"
    return
  fi

  echo "[eas-pre-install] ERROR: \$$secret_var not set and $out_path missing." >&2
  echo "[eas-pre-install] Set the EAS Secret or place the file locally before building." >&2
  exit 1
}

restore_file "GOOGLE_SERVICES_JSON_BASE64" "./google-services.json"
restore_file "GOOGLE_SERVICE_INFO_PLIST_BASE64" "./GoogleService-Info.plist"
