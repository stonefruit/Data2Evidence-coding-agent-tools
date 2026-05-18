---
name: data2evidence-code-rag
description: Use this skill when answering questions about the Data2Evidence codebase, doing codebase search, locating implementation details, finding routes/configuration/types/services, or preparing code changes where repository-specific context matters. It requires using the local Qdrant-backed Data2Evidence code RAG before relying on memory or plain text search; if Qdrant, llama.cpp, the embedding model, or the index is not ready, run setup automatically and only fall back with user approval.
---

# Data2Evidence Code RAG

## Default Workflow

Before answering Data2Evidence codebase questions, search the Qdrant code index. Use `rg` as a supplement, not as the first or only source, unless the Qdrant toolchain is unavailable and the user chooses not to set it up.

Work from:

```bash
cd tools/code-rag
```

Bootstrap embedding prerequisites automatically before querying:

```bash
which llama-server || brew install llama.cpp
test -f ../../.models/Qwen3-Embedding-0.6B-f16.gguf || make download-model
make check-embed
```

Rules:

- Do not just point to docs when embedding prerequisites are missing; run the bootstrap commands.
- If `make check-embed` fails, diagnose and retry once after checking `tools/code-rag/docs/llama-cpp-setup.md`.
- Only ask the user to approve a fallback to plain-text search if embedding setup remains blocked after retry.
- Prefer `make start-llama` before multiple queries and `make stop-llama` when done.
- `make check-embed`, `make query`, `make sync`, and `make web` reuse a healthy host `llama-server` when available, otherwise they auto-start a temporary one via `scripts/run_with_llama.sh`.

Start Qdrant and check whether an index is present:

```bash
make qdrant
make status
```

If `indexed_git_sha` is `null`, check for a snapshot before attempting sync (snapshot restore is much faster than full indexing):

```bash
ls -1 snapshots
make import-snapshot bundle=snapshots/<bundle-name>.tgz
make status
```

Only run `make sync` when no usable snapshot is available.

If the index exists (or has been restored), query it with focused natural-language questions:

```bash
make query q="Where is the MCP server name and version defined?"
```

Prefer multiple targeted queries over one broad query. Use returned file paths and snippets to guide code reading; inspect the actual files before making edits when precision matters.

Useful query shapes:

```bash
make query q="Which package routes map /mcp and /code-suggestion to functions?"
make query q="What endpoint handles code-suggestion chat requests and what request fields does it take?"
make query q="Where are the data mapping routes and generate suggestions endpoint defined?"
```

## Load More Only When Needed

Read [setup-indexing.md](references/setup-indexing.md) when Qdrant, the embedding model, or the index is missing/stale, or when the user asks about setup, model download, sync/reindex, snapshots, or the web UI.

Read `tools/code-rag/docs/llama-cpp-setup.md` when the embedding runtime is not ready (for example `llama-server` missing, embedding endpoint unreachable, or `make check-embed` fails). Follow that guide to install/start `llama.cpp` and verify embeddings before retrying RAG queries.
