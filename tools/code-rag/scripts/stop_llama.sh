#!/usr/bin/env bash
set -euo pipefail

LLAMA_PORT="${LLAMA_PORT:-8080}"
LLAMA_PID_FILE="${LLAMA_PID_FILE:-/tmp/llama-server-code-rag.pid}"
LAUNCHD_LABEL="${LAUNCHD_LABEL:-com.data2evidence.code-rag.llama}"
LAUNCHD_PLIST="${LAUNCHD_PLIST:-/tmp/${LAUNCHD_LABEL}.plist}"

if [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1; then
  if launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1; then
    rm -f "${LAUNCHD_PLIST}" "${LLAMA_PID_FILE}"
    echo "llama-server stopped."
    exit 0
  fi
fi

if [[ ! -f "${LLAMA_PID_FILE}" ]]; then
  if curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
    echo "llama-server is listening on port ${LLAMA_PORT}, but no PID file was found at ${LLAMA_PID_FILE}." >&2
    echo "Stop it manually or restart it with make start-llama so this tool can track the PID." >&2
    exit 1
  fi
  echo "llama-server is not running."
  exit 0
fi

SERVER_PID="$(cat "${LLAMA_PID_FILE}")"
if kill "${SERVER_PID}" >/dev/null 2>&1; then
  rm -f "${LLAMA_PID_FILE}"
  echo "llama-server stopped (pid ${SERVER_PID})."
else
  rm -f "${LLAMA_PID_FILE}"
  echo "llama-server was not running; removed stale PID file."
fi
