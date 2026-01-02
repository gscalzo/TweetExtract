#!/usr/bin/env bash
set -euo pipefail

if command -v make >/dev/null 2>&1; then
  make run ARGS="$*"
  exit 0
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm dev -- "$@"
else
  npm install
  npm run dev -- "$@"
fi
