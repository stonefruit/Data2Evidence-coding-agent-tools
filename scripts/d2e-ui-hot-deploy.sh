#!/usr/bin/env bash
set -euo pipefail

APP_REPO="${D2E_APP_REPO:-repos/Data2Evidence}"
UI_DIR="${D2E_UI_DIR:-$APP_REPO/ui}"
PROJECT="${1:?Usage: scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]}"
RESOURCE="${2:-$PROJECT}"

if [ "$PROJECT" = "vue-mri" ]; then
  RESOURCE="${2:-mri}"
fi

cd "$UI_DIR"
bunx nx build "$PROJECT"

TREX_CONTAINER="${TREX_CONTAINER:-$(docker ps --format '{{.Names}}' | grep trex | head -1)}"
if [ -z "$TREX_CONTAINER" ]; then
  echo "No running trex container found. Start the platform first." >&2
  exit 1
fi

docker exec "$TREX_CONTAINER" sh -c "rm -rf /usr/src/data/plugins/@data2evidence/d2e-ui/resources/$RESOURCE && cp -r /usr/src/local-resources/$RESOURCE /usr/src/data/plugins/@data2evidence/d2e-ui/resources/$RESOURCE"
