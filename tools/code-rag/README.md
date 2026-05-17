# Code RAG

Repository-aware RAG tooling for the Data2Evidence codebase and docs.

The first goal is a local engineering assistant that can answer questions about Data2Evidence with cited source files and line ranges. Product or chat integration should come later, after retrieval quality is measurable.

## MVP

- Index high-signal Data2Evidence files from `../../repos/Data2Evidence`
- Store chunks in Qdrant
- Query from a CLI or small HTTP API
- Return answers with source metadata
- Keep evaluation questions close to the code

## Quick Start

Install `llama.cpp` and download the embedding model first. On an M-series Mac, this keeps
inference on Apple Silicon/Metal instead of pushing it through Docker emulation.
See [docs/llama-cpp-setup.md](docs/llama-cpp-setup.md) for detailed setup and troubleshooting
notes.

Before starting the server, download an f16 GGUF for `Qwen3-Embedding-0.6B` into the repo-local
model folder:

```bash
make download-model
```

The `.models` folder is kept in git with `.gitkeep`, but the model files inside it are ignored.
The expected model path is:

```text
.models/Qwen3-Embedding-0.6B-f16.gguf
```

```bash
cd tools/code-rag
cp .env.example .env
make qdrant
make config
make sync
make query q="Where are Azure OpenAI environment variables configured?"
```

The default embedding path is local Qwen3 through `llama.cpp`:

```text
EMBEDDING_PROVIDER=openai_compatible
EMBEDDING_MODEL=qwen3-embedding-0.6b-f16
EMBEDDING_BASE_URL=http://host.docker.internal:8080/v1
EMBEDDING_API_KEY=local
EMBEDDING_DIMENSIONS=1024
EMBEDDING_APPEND_EOS=true
```

Most of these values are code defaults. The checked-in `.env.example` keeps them commented;
uncomment the optional lines there only when you need to override a default.

One stable shape for the embedding server is:

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

Use the f16 GGUF from the `Qwen/Qwen3-Embedding-0.6B-GGUF` Hugging Face repository. Qwen3
embeddings expect an end-of-text token; `code-rag` appends `<|endoftext|>` automatically when
`EMBEDDING_APPEND_EOS=true`.

The app and Qdrant still run in Docker using Docker's native platform default for the machine.
The `code-rag` container reaches the host `llama-server` through `host.docker.internal`.

When running through Docker, `../../repos/Data2Evidence` on the host is mounted read-only at
`/workspace/Data2Evidence` inside the `code-rag` container. So `make config` should show:

```json
{
  "repo_path": "/workspace/Data2Evidence",
  "qdrant_url": "http://qdrant:6333",
  "embedding_provider": "openai_compatible",
  "embedding_model": "qwen3-embedding-0.6b-f16",
  "embedding_base_url": "http://host.docker.internal:8080/v1",
  "embedding_dimensions": 1024,
  "embedding_append_eos": true
}
```

If you run `code-rag` directly on the host instead of through Docker, the repo path will resolve
to the local filesystem path.

Use the Makefile wrappers:

```bash
make qdrant
make start-llama
make config
make check-embed
make sync
make status
make changes
make query q="Where are Azure OpenAI environment variables configured?"
make web
make stop-llama
```

`make start-llama` starts a reusable host `llama-server`; `make stop-llama` stops the process it
started. `make check-embed`, `make sync`, `make reindex`, `make query`, and `make web` reuse an
already-running server when one is healthy. If none is running, they auto-start a temporary one,
wait for readiness, run the Docker command, and clean it up afterward.

The persistent start is platform-aware: macOS uses `launchctl`, Linux uses `setsid` when present,
and other Unix-like shells fall back to `nohup`. The macOS path is locally validated; the Linux
`setsid` path is included for non-macOS hosts but is not exercised on this Mac.

The Makefile still rebuilds the `code-rag` image before app commands so CLI changes are picked up.
Python dependencies are pinned in `pyproject.toml` and `constraints.txt`; update both together
when intentionally changing dependency versions.

`make status` compares the current Data2Evidence commit SHA with the commit SHA stored in the Qdrant index manifest.
`make changes` lists files changed since that indexed commit.
`make sync` does the normal update: it performs the first full index if needed, otherwise it
re-embeds only changed indexable files and deletes chunks for removed or excluded files.
Use `make reindex` only when you explicitly want to rebuild the whole collection from scratch.

During a full index, `code-rag` writes a local checkpoint at
`tools/code-rag/run-state/full-index-checkpoint.json` after each successfully indexed file. If
the run fails before the manifest is written, the next `make sync` resumes from that checkpoint
as long as the repo commit, embedding settings, chunk settings, and file content hashes still
match. The checkpoint is deleted after a successful full index.

## Sharing an Index

After a successful `make sync`, export the Qdrant collections into one portable bundle:

```bash
make export-snapshot
```

This writes a file like:

```text
tools/code-rag/snapshots/data2evidence-code-rag-qdrant-5abff7322f1f-20260516-220000.tgz
```

That bundle contains snapshots for both `d2e_code_chunks` and `d2e_code_chunks_manifest`, so
another developer can restore the vectors and the indexed commit metadata without recalculating
embeddings. It is a generated binary artifact; prefer Google Drive or Git LFS over normal git.
Qdrant's own intermediate snapshot files live under `tools/code-rag/qdrant-snapshots/`; they are
runtime scratch data and can be ignored or deleted after export/import.
The export/import helpers run inside the `code-rag` Docker container, so they use the same Python
runtime everywhere.

To restore a bundle:

```bash
make qdrant
make import-snapshot bundle=snapshots/data2evidence-code-rag-qdrant-5abff7322f1f-20260516-220000.tgz
make status
```

## HTTP API

Start the browser search UI:

```bash
make web
```

Then open:

```text
http://localhost:8088
```

The page embeds your text query through the configured embedding server, searches Qdrant, and
shows ranked chunks with file paths, line ranges, scores, modules, languages, and snippets.

```bash
docker compose run --rm --service-ports code-rag code-rag serve --host 0.0.0.0
```

Endpoints:

- `GET /health`
- `GET /stats`
- `GET /status`
- `GET /changes`
- `POST /sync`
- `POST /reindex`
- `POST /query`

Example:

```bash
curl -X POST http://localhost:8088/query \
  -H 'content-type: application/json' \
  -d '{"question":"How does the chat UI call the backend?","filters":{"module":"plugins/ui"}}'
```

## Scope

The indexer is allowlist-based. In Docker it reads `/workspace/Data2Evidence`, which is the
mounted form of host path `../../repos/Data2Evidence`. It starts with:

- `README.md`
- `env-vars.md`
- `docker-compose.yml`
- `docker-compose-local.yml`
- top-level source/config/docs files such as `*.ts`, `*.js`, `*.py`, `*.json`, `*.yml`,
  `*.yaml`, `*.toml`, `*.properties`, and `*.md`
- `services/`
- `plugins/`
- `scripts/`
- `internal/`

It excludes generated files, binaries, lockfiles, build output, `.env*`, certificates, archives, and oversized files.
