#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5555}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

exec npx --yes serve -l "$PORT" marketing
