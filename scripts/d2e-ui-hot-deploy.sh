#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_REPO="${D2E_APP_REPO:-$ROOT_DIR/repos/Data2Evidence}"
UI_DIR="${D2E_UI_DIR:-$APP_REPO/plugins/ui}"
PROJECT="${1:-}"
RESOURCE_OVERRIDE="${2:-}"

usage() {
  cat <<'EOF'
Usage: scripts/d2e-ui-hot-deploy.sh <ui-project> [resource-dir]

Known UI projects:
  portal, flow, mapping, concept-mapping, concept-sets, jobs
  analysis-ui, analysis, notebook-ui, webr-notebook, notebook, wizards
  vue-mri, mri, mri-ui5, mri-pa-ui, ui5
  starboard, starboard-jupyter, starboard-notebook-base
  all

The optional resource-dir overrides the resource folder copied into trex.
EOF
}

if [ -z "$PROJECT" ] || [ "$PROJECT" = "-h" ] || [ "$PROJECT" = "--help" ]; then
  usage
  if [ -z "$PROJECT" ]; then
    exit 1
  fi
  exit 0
fi

BUILD_KIND="nx"
BUILD_TARGET="$PROJECT"
APP_SUBDIR=""
ROOT_SCRIPT=""
NX_TARGET="build"
RESOURCES=()

case "$PROJECT" in
  all)
    BUILD_KIND="root-script"
    ROOT_SCRIPT="build-all"
    RESOURCES=(
      "portal"
      "flow"
      "mapping"
      "concept-mapping"
      "concept-sets"
      "notebook-ui"
      "notebook"
      "analysis-ui"
      "wizards"
      "jobs"
      "starboard-jupyter"
      "starboard-notebook-base"
      "mri"
      "mri-ui5"
      "ui5"
    )
    ;;
  analysis)
    BUILD_TARGET="analysis-ui"
    RESOURCES=("analysis-ui")
    ;;
  concept-sets)
    BUILD_KIND="vite"
    APP_SUBDIR="apps/concept-sets"
    RESOURCES=("concept-sets")
    ;;
  mri|vue-mri)
    BUILD_KIND="vite"
    APP_SUBDIR="apps/vue-mri-ui-lib"
    BUILD_TARGET="vue-mri"
    RESOURCES=("mri")
    ;;
  mri-pa-ui|mri-ui5)
    BUILD_KIND="nx-target"
    BUILD_TARGET="portal"
    NX_TARGET="build-mri"
    RESOURCES=("mri-ui5")
    ;;
  notebook|webr-notebook)
    BUILD_TARGET="webr-notebook"
    RESOURCES=("notebook")
    ;;
  portal-ui)
    BUILD_KIND="portal-ui"
    BUILD_TARGET="portal"
    RESOURCES=("portal" "mri-ui5")
    ;;
  starboard)
    BUILD_KIND="root-script"
    ROOT_SCRIPT="build-starboard"
    RESOURCES=("starboard-jupyter" "starboard-notebook-base")
    ;;
  starboard-jupyter|starboard-notebook-base)
    BUILD_KIND="root-script"
    ROOT_SCRIPT="build-starboard"
    RESOURCES=("$PROJECT")
    ;;
  ui5)
    BUILD_KIND="root-script"
    ROOT_SCRIPT="build-ui5"
    RESOURCES=("ui5")
    ;;
  wizards)
    BUILD_KIND="vite"
    APP_SUBDIR="apps/wizards"
    RESOURCES=("wizards")
    ;;
  *)
    RESOURCES=("$PROJECT")
    ;;
esac

if [ ! -d "$UI_DIR" ]; then
  echo "UI directory not found: $UI_DIR" >&2
  echo "Set D2E_UI_DIR or D2E_APP_REPO if your checkout lives elsewhere." >&2
  exit 1
fi

if [ -n "$RESOURCE_OVERRIDE" ]; then
  if [ "$PROJECT" = "all" ]; then
    echo "resource-dir override is not supported with project 'all'." >&2
    exit 1
  fi
  RESOURCES=("$RESOURCE_OVERRIDE")
fi

for RESOURCE in "${RESOURCES[@]}"; do
  case "$RESOURCE" in
    ""|*/*|*".."*|*[!A-Za-z0-9._-]*)
      echo "Invalid resource dir: $RESOURCE" >&2
      exit 1
      ;;
  esac
done

cd "$UI_DIR"

case "$BUILD_KIND" in
  nx)
    NX_DAEMON=false bunx nx build "$BUILD_TARGET"
    ;;
  nx-target)
    NX_DAEMON=false bunx nx "$NX_TARGET" "$BUILD_TARGET"
    ;;
  portal-ui)
    NX_DAEMON=false bunx nx build "@portal/plugin"
    NX_DAEMON=false bunx nx build "@portal/components"
    NX_DAEMON=false bunx nx build "$BUILD_TARGET"
    NX_DAEMON=false bunx nx build-mri "$BUILD_TARGET"
    ;;
  root-script)
    bun run "$ROOT_SCRIPT"
    ;;
  vite)
    (cd "$UI_DIR/$APP_SUBDIR" && bunx vite build)
    ;;
  *)
    echo "Unknown build kind: $BUILD_KIND" >&2
    exit 1
    ;;
esac

for RESOURCE in "${RESOURCES[@]}"; do
  RESOURCE_DIR="$UI_DIR/resources/$RESOURCE"
  if [ ! -d "$RESOURCE_DIR" ]; then
    echo "Build completed, but resource directory was not found: $RESOURCE_DIR" >&2
    exit 1
  fi
done

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

for RESOURCE in "${RESOURCES[@]}"; do
  RESOURCE_DIR="$UI_DIR/resources/$RESOURCE"
  for TARGET_BASE in "${TARGET_BASES[@]}"; do
    TARGET_DIR="$TARGET_BASE/$RESOURCE"
    docker exec "$TREX_CONTAINER" sh -c "rm -rf '$TARGET_DIR' && mkdir -p '$TARGET_DIR'"
    docker cp "$RESOURCE_DIR/." "$TREX_CONTAINER:$TARGET_DIR"
    echo "Deployed $PROJECT resources from $RESOURCE_DIR to $TREX_CONTAINER:$TARGET_DIR"
  done
done
