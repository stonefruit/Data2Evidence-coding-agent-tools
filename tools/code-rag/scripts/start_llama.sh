#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_PATH="${MODEL_PATH:-${TOOL_DIR}/../../.models/Qwen3-Embedding-0.6B-f16.gguf}"
LLAMA_SERVER_BIN="${LLAMA_SERVER_BIN:-llama-server}"
LLAMA_HOST="${LLAMA_HOST:-0.0.0.0}"
LLAMA_PORT="${LLAMA_PORT:-8080}"
LLAMA_CTX="${LLAMA_CTX:-8192}"
LLAMA_UBATCH="${LLAMA_UBATCH:-1024}"
LLAMA_LOG="${LLAMA_LOG:-/tmp/llama-server-code-rag.log}"
LLAMA_PID_FILE="${LLAMA_PID_FILE:-/tmp/llama-server-code-rag.pid}"
LAUNCHD_LABEL="${LAUNCHD_LABEL:-com.data2evidence.code-rag.llama}"
LAUNCHD_PLIST="${LAUNCHD_PLIST:-/tmp/${LAUNCHD_LABEL}.plist}"

if curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
  echo "llama-server is already listening on port ${LLAMA_PORT}."
  exit 0
fi

if ! command -v "${LLAMA_SERVER_BIN}" >/dev/null 2>&1; then
  echo "Could not find ${LLAMA_SERVER_BIN} on PATH. Install llama.cpp first." >&2
  exit 1
fi
LLAMA_SERVER_BIN="$(command -v "${LLAMA_SERVER_BIN}")"

if [[ ! -f "${MODEL_PATH}" ]]; then
  echo "Embedding model not found: ${MODEL_PATH}" >&2
  echo "Run: make download-model" >&2
  exit 1
fi

if [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1; then
  : >"${LLAMA_LOG}"
  cat >"${LAUNCHD_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${LLAMA_SERVER_BIN}</string>
    <string>-m</string>
    <string>${MODEL_PATH}</string>
    <string>--embedding</string>
    <string>--pooling</string>
    <string>last</string>
    <string>-c</string>
    <string>${LLAMA_CTX}</string>
    <string>-ub</string>
    <string>${LLAMA_UBATCH}</string>
    <string>--host</string>
    <string>${LLAMA_HOST}</string>
    <string>--port</string>
    <string>${LLAMA_PORT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LLAMA_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LLAMA_LOG}</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "${LAUNCHD_PLIST}"
elif command -v setsid >/dev/null 2>&1; then
  setsid "${LLAMA_SERVER_BIN}" \
    -m "${MODEL_PATH}" \
    --embedding \
    --pooling last \
    -c "${LLAMA_CTX}" \
    -ub "${LLAMA_UBATCH}" \
    --host "${LLAMA_HOST}" \
    --port "${LLAMA_PORT}" >"${LLAMA_LOG}" 2>&1 < /dev/null &
  SERVER_PID=$!
  echo "${SERVER_PID}" >"${LLAMA_PID_FILE}"
else
  nohup "${LLAMA_SERVER_BIN}" \
    -m "${MODEL_PATH}" \
    --embedding \
    --pooling last \
    -c "${LLAMA_CTX}" \
    -ub "${LLAMA_UBATCH}" \
    --host "${LLAMA_HOST}" \
    --port "${LLAMA_PORT}" >"${LLAMA_LOG}" 2>&1 &
  SERVER_PID=$!
  echo "${SERVER_PID}" >"${LLAMA_PID_FILE}"
fi

READY=0
for _ in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY}" -ne 1 ]]; then
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  elif [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1 || true
  fi
  rm -f "${LAUNCHD_PLIST}" "${LLAMA_PID_FILE}"
  echo "Timed out waiting for llama-server on port ${LLAMA_PORT}." >&2
  echo "Recent log output from ${LLAMA_LOG}:" >&2
  tail -n 80 "${LLAMA_LOG}" >&2 || true
  exit 1
fi

echo "llama-server started on port ${LLAMA_PORT}."
