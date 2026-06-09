---
name: data2evidence-code-rag
description: Deprecated legacy skill for maintaining or explicitly using the Data2Evidence local Qdrant code RAG. Do not use for normal Data2Evidence codebase search, implementation lookup, route/config/type/service discovery, or code changes; use direct source inspection with rg and matching subsystem skills instead. Only load this skill when the user explicitly asks for the legacy code-rag tool, Qdrant index, snapshots, embedding setup, or RAG maintenance.
---

# Data2Evidence Code RAG (Deprecated)

This workflow is deprecated because the local RAG has not been useful enough for day-to-day Data2Evidence work.

For normal Data2Evidence codebase questions or code changes:

1. Load any matching subsystem skill first.
2. Use direct source inspection with `rg`, `rg --files`, and targeted file reads.
3. Do not bootstrap Qdrant, llama.cpp, embedding models, snapshots, or `make query`.

Use the legacy workflow below only when the user explicitly asks to inspect, run, repair, or maintain the code-rag tool.

## Legacy Workflow

For explicit code-rag maintenance tasks, work from:

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
