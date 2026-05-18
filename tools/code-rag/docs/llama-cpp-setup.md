# llama.cpp Setup For Code RAG

This setup runs the embedding model on the host Mac with `llama.cpp`, while Qdrant and the
`code-rag` app run in Docker. On an Apple Silicon Mac this lets `llama.cpp` use Metal directly,
instead of running inference inside a container.

Official references:

- [llama.cpp install docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md)
- [llama.cpp build docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
- [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)

## Install llama.cpp

Use Homebrew for the simple path:

```bash
brew install llama.cpp
```

The upstream docs list Homebrew as a supported install path. If you build from source instead,
the upstream build docs say Metal is enabled by default on macOS; that is what we want for
M-series Macs.

Check that the server binary is available:

```bash
llama-server --help
```

## Download The Embedding Model

From the code-rag tool directory:

```bash
cd tools/code-rag
make download-model
```

This downloads:

```text
https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-f16.gguf
```

Expected local path:

```text
.models/Qwen3-Embedding-0.6B-f16.gguf
```

The `.models` directory is intentionally ignored by git except for `.gitkeep`.

## Start The Embedding Server

Run this from `tools/code-rag`:

```bash
llama-server \
  -m ../../.models/Qwen3-Embedding-0.6B-f16.gguf \
  --embedding \
  --pooling last \
  -c 8192 \
  -ub 1024 \
  --host 0.0.0.0 \
  --port 8080
```

Why these flags:

- `--embedding` serves embeddings instead of chat/completions.
- `--pooling last` matches the Qwen3 embedding usage we are testing.
- `-c 8192` is enough for current chunk sizes and is more stable on laptops.
- `-ub 1024` lowers memory pressure while preserving good embedding throughput.
- `--host 0.0.0.0` allows Docker containers to reach the host server.
- `--port 8080` matches `EMBEDDING_BASE_URL=http://host.docker.internal:8080/v1`.

You can also use the Makefile wrapper to keep the server warm across multiple commands:

```bash
make start-llama
make query q="Where are Azure OpenAI environment variables configured?"
make stop-llama
```

On macOS, `make start-llama` uses `launchctl` so the host process is detached from the calling
shell. On Linux, it uses `setsid` when available and falls back to `nohup`. The macOS path is
locally validated; the Linux path is included for non-macOS hosts but is not exercised on this
Mac.

Embedding-dependent commands (`check-embed`, `sync`, `reindex`, `query`, and `web`) reuse a
healthy server if one is already listening. If not, they auto-start a temporary `llama-server`
through `scripts/run_with_llama.sh` and clean it up when the command finishes.

## Verify From code-rag

In another terminal:

```bash
cd tools/code-rag
make check-embed
```

Expected output:

```text
1024
```

That confirms the Dockerized `code-rag` app can call the host `llama-server` through
`host.docker.internal` and that the returned vector size matches the Qdrant collection settings.

## Use It

Start Qdrant:

```bash
make qdrant
```

Then query an existing index:

```bash
make query q="Where are Azure OpenAI environment variables configured?"
```

Or sync a clean checkout:

```bash
make sync
```

Only run indexing commands against a clean Data2Evidence checkout from GitHub. Check first:

```bash
git -C ../../repos/Data2Evidence status --short
git -C ../../repos/Data2Evidence remote get-url origin
git -C ../../repos/Data2Evidence rev-parse HEAD
```

Do not index local experimental changes. Commit, stash, or use a clean clone first.

## Troubleshooting

If `make check-embed` cannot connect:

- Confirm `llama-server` is still running.
- Confirm it is listening on port `8080`.
- Confirm it was started with `--host 0.0.0.0`, not only `127.0.0.1`.
- Confirm `.env` has not overridden `EMBEDDING_BASE_URL` away from
  `http://host.docker.internal:8080/v1`.

If the vector dimension is not `1024`:

- Confirm the model file is `Qwen3-Embedding-0.6B-f16.gguf`.
- Confirm `EMBEDDING_DIMENSIONS=1024` if you overrode defaults in `.env`.
- Recreate/reindex the Qdrant collection only after confirming the model and dimensions are right.

If `llama-server` is slow or appears CPU-bound:

- Prefer host-native `llama.cpp` on the M-series Mac.
- Do not run the embedding model inside the `code-rag` Docker container for the Mac setup.
- If building from source, confirm the build includes Metal support.
