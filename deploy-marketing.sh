#!/usr/bin/env bash
set -euo pipefail

# Deploy only the marketing directory to Cloudflare Pages
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_DIR="$SCRIPT_DIR/marketing"

if [[ ! -d "$MARKETING_DIR" ]]; then
  echo "Marketing directory not found: $MARKETING_DIR" >&2
  exit 1
fi

cd "$MARKETING_DIR"
exec wrangler pages deploy . --project-name=sam-tracker
