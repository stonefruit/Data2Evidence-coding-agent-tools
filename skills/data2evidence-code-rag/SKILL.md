---
name: data2evidence-code-rag
description: Use this skill when answering questions about the Data2Evidence codebase, doing codebase search, locating implementation details, finding routes/configuration/types/services, or preparing code changes where repository-specific context matters. It requires using the local Qdrant-backed Data2Evidence code RAG before relying on memory or plain text search; if Qdrant, the embedding model, or the index is not ready, explain the setup steps or help run them.
---

# Data2Evidence Code RAG

## Default Workflow

Before answering Data2Evidence codebase questions, search the Qdrant code index. Use `rg` as a supplement, not as the first or only source, unless the Qdrant toolchain is unavailable and the user chooses not to set it up.

Work from:

```bash
cd tools/code-rag
```

Start Qdrant and check whether an index is present:

```bash
make qdrant
make status
```

If the index exists, query it with focused natural-language questions:

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

Read [setup-indexing.md](references/setup-indexing.md) only if Qdrant, the embedding model, or the index is missing/stale, or if the user asks about setup, model download, sync/reindex, snapshots, or the web UI.
