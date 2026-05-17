---
name: data2evidence-code-rag
description: Use this skill when answering questions about the Data2Evidence codebase, doing codebase search, locating implementation details, finding routes/configuration/types/services, or preparing code changes where repository-specific context matters. It requires using the local Qdrant-backed Data2Evidence code RAG before relying on memory or plain text search; if Qdrant, llama.cpp, the embedding model, or the index is not ready, run setup automatically and only fall back with user approval.
---

# Data2Evidence Code RAG (Codex Wrapper)

This is the Codex-specific wrapper for skill discovery.

Canonical instructions live in:

`skills/data2evidence-code-rag/SKILL.md`

When this skill triggers, load and follow that shared skill file (and its referenced files) as the source of truth.
