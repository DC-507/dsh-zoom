#!/bin/sh
# Fallback global scaling for DeepSeek Harness (desktop), used if the
# dsh-zoom plugin cannot be loaded.
#
# Scales the WHOLE UI (sidebar, menus, conversation) via Chromium's device
# scale factor. Quit the app first — a running instance ignores new launch
# arguments (single-instance lock).
#
#   sh launch-big.sh          # 1.2x
#   sh launch-big.sh 1.35     # custom factor
set -e

FACTOR="${1:-1.2}"

if pgrep -f "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" >/dev/null 2>&1; then
  echo "DeepSeek Harness is running — quit it first (Cmd+Q), then run this again." >&2
  exit 1
fi

echo "launching DeepSeek Harness with --force-device-scale-factor=$FACTOR"
open -a "DeepSeek Harness" --args --force-device-scale-factor="$FACTOR"
