#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEFAULT_ENV_FILE_FALLBACK="/Users/felixlee/Documents/ChiefFaFaBot/.env"
DEFAULT_REPO="FelixLee888/Chief-Fafa-Recipe"
DEFAULT_REDIRECT_URI="http://127.0.0.1:8788/callback"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  DEFAULT_ENV_FILE="${PROJECT_ROOT}/.env"
else
  DEFAULT_ENV_FILE="$DEFAULT_ENV_FILE_FALLBACK"
fi

ENV_FILE="${RECIPE_ENV_FILE:-$DEFAULT_ENV_FILE}"
REPO="$DEFAULT_REPO"
REDIRECT_URI="$DEFAULT_REDIRECT_URI"
LOGIN_HINT="${GOOGLE_OAUTH_LOGIN_HINT:-jancefelix@gmail.com}"
CLIENT_SECRET_FILE=""
CODE=""
CALLBACK_URL=""
UPDATE_GITHUB_SECRETS=1
UPDATE_LOCAL_ENV=1
KEEP_TEMP=0

usage() {
  cat <<'EOF'
Rotate Google Docs OAuth tokens and update GitHub Actions secrets.

Usage:
  scripts/rotate_google_oauth_secrets.sh [options]

Options:
  --code <auth_code>            OAuth authorization code from Google callback URL
  --callback-url <url>          Full callback URL containing ?code=...
  --repo <owner/repo>           GitHub repository (default: FelixLee888/Chief-Fafa-Recipe)
  --env-file <path>             Local env file (default: RECIPE_ENV_FILE, then ./ .env, then /Users/felixlee/Documents/ChiefFaFaBot/.env)
  --redirect-uri <uri>          OAuth redirect URI (default: http://127.0.0.1:8788/callback)
  --login-hint <email>          Login hint used when generating consent URL
  --client-secret-file <path>   Google OAuth client secret JSON file (optional)
  --no-github-secrets           Do not update GitHub secrets
  --no-local-env                Do not update local env file
  --keep-temp                   Keep generated temp files
  --help                        Show this help

Behavior:
  - If --code/--callback-url is omitted, the script prints a consent URL.
  - If code is provided, it exchanges code for tokens and updates:
      GOOGLE_DOCS_REFRESH_TOKEN
      GOOGLE_DOCS_ACCESS_TOKEN
EOF
}

log() {
  printf '[rotate-oauth] %s\n' "$*"
}

die() {
  printf '[rotate-oauth] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --code)
      CODE="${2:-}"
      shift 2
      ;;
    --callback-url)
      CALLBACK_URL="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --redirect-uri)
      REDIRECT_URI="${2:-}"
      shift 2
      ;;
    --login-hint)
      LOGIN_HINT="${2:-}"
      shift 2
      ;;
    --client-secret-file)
      CLIENT_SECRET_FILE="${2:-}"
      shift 2
      ;;
    --no-github-secrets)
      UPDATE_GITHUB_SECRETS=0
      shift
      ;;
    --no-local-env)
      UPDATE_LOCAL_ENV=0
      shift
      ;;
    --keep-temp)
      KEEP_TEMP=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

need_cmd node
need_cmd awk
need_cmd sed
need_cmd mktemp

if [[ ! -f "$ENV_FILE" ]]; then
  die "Env file not found: $ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

CLIENT_ID="${GOOGLE_DOCS_CLIENT_ID:-${GOOGLE_KEEP_CLIENT_ID:-}}"
CLIENT_SECRET="${GOOGLE_DOCS_CLIENT_SECRET:-${GOOGLE_KEEP_CLIENT_SECRET:-}}"
if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  if [[ "$ENV_FILE" != "$DEFAULT_ENV_FILE_FALLBACK" && -f "$DEFAULT_ENV_FILE_FALLBACK" ]]; then
    ENV_FILE="$DEFAULT_ENV_FILE_FALLBACK"
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    CLIENT_ID="${GOOGLE_DOCS_CLIENT_ID:-${GOOGLE_KEEP_CLIENT_ID:-}}"
    CLIENT_SECRET="${GOOGLE_DOCS_CLIENT_SECRET:-${GOOGLE_KEEP_CLIENT_SECRET:-}}"
  fi
fi
if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  die "Missing GOOGLE_DOCS_CLIENT_ID/GOOGLE_DOCS_CLIENT_SECRET in env"
fi

if [[ -n "$CALLBACK_URL" && -z "$CODE" ]]; then
  CODE="$(node -e "const input=process.argv[1]||'';let code='';try{const url=new URL(input);code=url.searchParams.get('code')||'';}catch{};process.stdout.write(code);" "$CALLBACK_URL")"
  [[ -n "$CODE" ]] || die "Could not parse code from callback URL"
fi

TMP_CLIENT_SECRET=""
cleanup() {
  if [[ "$KEEP_TEMP" -eq 0 ]]; then
    [[ -n "$TMP_CLIENT_SECRET" && -f "$TMP_CLIENT_SECRET" ]] && rm -f "$TMP_CLIENT_SECRET"
  fi
}
trap cleanup EXIT

if [[ -n "$CLIENT_SECRET_FILE" ]]; then
  [[ -f "$CLIENT_SECRET_FILE" ]] || die "Client secret file not found: $CLIENT_SECRET_FILE"
  TMP_CLIENT_SECRET="$CLIENT_SECRET_FILE"
else
  TMP_CLIENT_SECRET="$(mktemp /tmp/chief_fafa_client_secret.XXXXXX.json)"
  node -e "
    const fs=require('node:fs');
    const file=process.argv[1];
    const clientId=process.argv[2];
    const clientSecret=process.argv[3];
    const redirectUri=process.argv[4];
    const payload={
      installed:{
        client_id:clientId,
        client_secret:clientSecret,
        redirect_uris:[redirectUri],
        auth_uri:'https://accounts.google.com/o/oauth2/auth',
        token_uri:'https://oauth2.googleapis.com/token'
      }
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  " "$TMP_CLIENT_SECRET" "$CLIENT_ID" "$CLIENT_SECRET" "$REDIRECT_URI"
fi

if [[ -z "$CODE" ]]; then
  log "No code supplied. Generating consent URL..."
  node "${PROJECT_ROOT}/scripts/google_docs_oauth_setup.mjs" \
    --client-secret-file "$TMP_CLIENT_SECRET" \
    --redirect-uri "$REDIRECT_URI" \
    --login-hint "$LOGIN_HINT"
  log "After authorizing, rerun with --callback-url '<redirect_url>' or --code '<code>'."
  exit 0
fi

log "Exchanging authorization code for new tokens..."
SETUP_OUTPUT="$(node "${PROJECT_ROOT}/scripts/google_docs_oauth_setup.mjs" \
  --client-secret-file "$TMP_CLIENT_SECRET" \
  --redirect-uri "$REDIRECT_URI" \
  --code "$CODE")"

REFRESH_TOKEN="$(printf '%s\n' "$SETUP_OUTPUT" | sed -n 's/^GOOGLE_DOCS_REFRESH_TOKEN=//p' | head -n1)"
ACCESS_TOKEN="$(printf '%s\n' "$SETUP_OUTPUT" | sed -n 's/^GOOGLE_DOCS_ACCESS_TOKEN=//p' | head -n1)"

[[ -n "$REFRESH_TOKEN" ]] || die "No refresh token returned. Re-run consent and ensure prompt=consent."

if [[ "$UPDATE_GITHUB_SECRETS" -eq 1 ]]; then
  need_cmd gh
  log "Updating GitHub Actions secrets on ${REPO}..."
  gh auth status >/dev/null
  gh secret set GOOGLE_DOCS_REFRESH_TOKEN --repo "$REPO" --body "$REFRESH_TOKEN" >/dev/null
  if [[ -n "$ACCESS_TOKEN" ]]; then
    gh secret set GOOGLE_DOCS_ACCESS_TOKEN --repo "$REPO" --body "$ACCESS_TOKEN" >/dev/null
  fi
  log "GitHub secrets updated."
fi

if [[ "$UPDATE_LOCAL_ENV" -eq 1 ]]; then
  log "Updating local env file: $ENV_FILE"
  TMP_ENV="$(mktemp /tmp/chief_fafa_env.XXXXXX)"
  awk -v refresh="$REFRESH_TOKEN" -v access="$ACCESS_TOKEN" '
    BEGIN { seen_refresh=0; seen_access=0; }
    /^GOOGLE_DOCS_REFRESH_TOKEN=/ {
      print "GOOGLE_DOCS_REFRESH_TOKEN=" refresh;
      seen_refresh=1;
      next;
    }
    /^GOOGLE_DOCS_ACCESS_TOKEN=/ {
      if (access != "") {
        print "GOOGLE_DOCS_ACCESS_TOKEN=" access;
        seen_access=1;
      }
      next;
    }
    { print; }
    END {
      if (!seen_refresh) print "GOOGLE_DOCS_REFRESH_TOKEN=" refresh;
      if (access != "" && !seen_access) print "GOOGLE_DOCS_ACCESS_TOKEN=" access;
    }
  ' "$ENV_FILE" > "$TMP_ENV"
  mv "$TMP_ENV" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  log "Local env updated."
fi

log "Token rotation complete."
log "Refresh token length: ${#REFRESH_TOKEN}"
if [[ -n "$ACCESS_TOKEN" ]]; then
  log "Access token length: ${#ACCESS_TOKEN}"
fi
