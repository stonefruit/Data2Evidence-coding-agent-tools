#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_REPO="${D2E_APP_REPO:-$ROOT_DIR/repos/Data2Evidence}"
UI_DIR="${D2E_UI_DIR:-$APP_REPO/plugins/ui}"
PROJECT="${1:?Usage: scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]}"
RESOURCE="${2:-$PROJECT}"

if [ "$PROJECT" = "vue-mri" ]; then
  RESOURCE="${2:-mri}"
fi

case "$RESOURCE" in
  ""|*/*|*".."*|*[!A-Za-z0-9._-]*)
    echo "Invalid resource dir: $RESOURCE" >&2
    exit 1
    ;;
esac

if [ ! -d "$UI_DIR" ]; then
  echo "UI directory not found: $UI_DIR" >&2
  echo "Set D2E_UI_DIR or D2E_APP_REPO if your checkout lives elsewhere." >&2
  exit 1
fi

cd "$UI_DIR"
NX_DAEMON=false bunx nx build "$PROJECT"

RESOURCE_DIR="$UI_DIR/resources/$RESOURCE"
if [ ! -d "$RESOURCE_DIR" ]; then
  echo "Build completed, but resource directory was not found: $RESOURCE_DIR" >&2
  exit 1
fi

TREX_CONTAINER="${TREX_CONTAINER:-}"
if [ -z "$TREX_CONTAINER" ]; then
  DEFAULT_TREX="${PROJECT_NAME:-d2e}-trex"
  if docker ps --format '{{.Names}}' | grep -Fxq "$DEFAULT_TREX"; then
    TREX_CONTAINER="$DEFAULT_TREX"
  else
    TREX_CONTAINER="$(docker ps --format '{{.Names}}' | grep 'trex$' | head -1 || true)"
  fi
fi

if [ -z "$TREX_CONTAINER" ]; then
  echo "No running trex container found. Start the platform first." >&2
  exit 1
fi

TARGET_BASES=(
  "/usr/src/data/plugins/@data2evidence/d2e-ui/resources"
  "/usr/src/bundled-plugins/d2e-ui/resources"
)

for TARGET_BASE in "${TARGET_BASES[@]}"; do
  TARGET_DIR="$TARGET_BASE/$RESOURCE"
  docker exec "$TREX_CONTAINER" sh -c "rm -rf '$TARGET_DIR' && mkdir -p '$TARGET_DIR'"
  docker cp "$RESOURCE_DIR/." "$TREX_CONTAINER:$TARGET_DIR"
  echo "Deployed $PROJECT resources from $RESOURCE_DIR to $TREX_CONTAINER:$TARGET_DIR"
done
