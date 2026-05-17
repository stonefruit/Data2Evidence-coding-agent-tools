#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 2
fi

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

if ! command -v "${LLAMA_SERVER_BIN}" >/dev/null 2>&1; then
  echo "Could not find ${LLAMA_SERVER_BIN} on PATH. Install llama.cpp first." >&2
  exit 1
fi

if [[ ! -f "${MODEL_PATH}" ]]; then
  echo "Embedding model not found: ${MODEL_PATH}" >&2
  echo "Run: make download-model" >&2
  exit 1
fi

cleanup() {
  if [[ "${OWN_SERVER:-0}" -eq 1 && -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
    rm -f "${LLAMA_PID_FILE}"
  fi
}
trap cleanup EXIT INT TERM

OWN_SERVER=0
if ! curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
  "${LLAMA_SERVER_BIN}" \
    -m "${MODEL_PATH}" \
    --embedding \
    --pooling last \
    -c "${LLAMA_CTX}" \
    -ub "${LLAMA_UBATCH}" \
    --host "${LLAMA_HOST}" \
    --port "${LLAMA_PORT}" >"${LLAMA_LOG}" 2>&1 &
  SERVER_PID=$!
  OWN_SERVER=1
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
  echo "Timed out waiting for llama-server on port ${LLAMA_PORT}." >&2
  echo "Recent log output from ${LLAMA_LOG}:" >&2
  tail -n 80 "${LLAMA_LOG}" >&2 || true
  exit 1
fi

"$@"
