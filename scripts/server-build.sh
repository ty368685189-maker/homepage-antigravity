#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export SITE_URL="${SITE_URL:-https://blog.yugold.top/}"

corepack pnpm install --frozen-lockfile
corepack pnpm build
