#!/bin/sh
# Publish dsh-zoom to the npm registry.
#
#   sh publish.sh                 # publish as latest
#   sh publish.sh --tag next      # publish under a different dist-tag
#   sh publish.sh --otp 123456    # when the account requires a one-time code
#
# Requires `npm login` first (or a granular access token in ~/.npmrc).
# NPM_CACHE can point the cache at a writable directory when the default
# ~/.npm cache is not usable from the current context.
set -e

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HERE"

if [ -n "${NPM_CACHE:-}" ]; then
  export npm_config_cache="$NPM_CACHE"
  mkdir -p "$npm_config_cache"
fi

if ! npm whoami >/dev/null 2>&1; then
  echo "not logged in to npm — run: npm login" >&2
  exit 1
fi

echo "publishing dsh-zoom as $(npm whoami)…"
npm test
npm publish "$@"
