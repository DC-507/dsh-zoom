#!/bin/sh
# Remove the dsh-zoom plugin from the desktop profile.
#
#   sh rollback.sh
#
# Preferred path is the app's own plugin manager, which drops the dependency
# AND filters "dsh-zoom" out of dsh.profile.bundles. The backup/ copies taken
# before installation are the manual fallback.
set -e

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
CLI="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

echo "profile: $PROFILE"

if [ -x "$CLI" ]; then
  echo "removing via the bundled plugin manager…"
  DSH_HOME="${DSH_HOME:-$HOME/.dsh}" "$CLI" plugin --profile desktop remove dsh-zoom || {
    echo "plugin manager removal failed — falling back to the saved profile files" >&2
    for f in package.json cordis.patch.yml pnpm-workspace.yaml; do
      [ -f "$HERE/backup/$f" ] && cp -p "$HERE/backup/$f" "$PROFILE/$f" && echo "restored $f"
    done
  }
fi

# Drop any leftover link so nothing half-installed survives.
rm -rf "$PROFILE/node_modules/dsh-zoom" 2>/dev/null || true

echo "done — restart DeepSeek Harness for the change to take effect"
