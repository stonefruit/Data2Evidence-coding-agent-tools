# Setup, Indexing, And Sharing

Use this reference only when the default query workflow cannot proceed, the index is stale/missing, or the user asks how to set up, reindex, import/export, or demo the RAG.

## Embedding Model

For the full host-native `llama.cpp` setup, see
`/Users/stonefruit/Dev/Data4Life/Data2Evidence-coding-agent-tools/tools/code-rag/docs/llama-cpp-setup.md`.

The f16 GGUF model should live at:

```text
.models/Qwen3-Embedding-0.6B-f16.gguf
```

Download link:

```text
https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-f16.gguf
```

Wrapper command:

```bash
make download-model
```

Start a reusable host-native `llama.cpp` server when running multiple queries:

```bash
make start-llama
```

Check embeddings:

```bash
make check-embed
```

Expected output is `1024`.

Stop the reusable server when finished:

```bash
make stop-llama
```

Embedding-dependent commands (`make check-embed`, `make query`, `make sync`, `make reindex`,
and `make web`) also reuse an already-running server. If one is not running, they start a
temporary `llama-server` for that command and clean it up afterward.

## Missing Index

Prefer restoring a snapshot before recalculating embeddings:

```bash
make import-snapshot bundle=snapshots/data2evidence-code-rag-qdrant-<sha>-<timestamp>.tgz
make status
```

Importing a snapshot does not require the embedding server. Querying, syncing, and reindexing do.

## Sync And Reindex

Use `make sync` for normal updates. It performs the first full index if needed, then later re-embeds only changed files:

```bash
make sync
make status
```

Use `make reindex` only when the whole collection must be rebuilt because embedding settings, chunking settings, or indexer policy changed:

```bash
make reindex
```

Only run `make sync` or `make reindex` against a clean Data2Evidence checkout that came directly from GitHub. Before indexing, verify:

```bash
git -C ../../repos/Data2Evidence status --short
git -C ../../repos/Data2Evidence remote get-url origin
git -C ../../repos/Data2Evidence rev-parse HEAD
```

Do not index if `status --short` has output, if the repo is not the intended GitHub remote, or if the user is asking to index local experimental changes. Ask the user to commit/stash/revert first, or import a known snapshot.

## Sharing Indexes

Export after a successful clean sync:

```bash
make export-snapshot
```

Snapshot bundle names include the indexed commit SHA and timestamp:

```text
data2evidence-code-rag-qdrant-<short-sha>-<timestamp>.tgz
```

Share snapshot bundles through Google Drive or Git LFS, not ordinary git.

## Web UI

For interactive demo/search:

```bash
make web
```

Open `http://localhost:8088`.
