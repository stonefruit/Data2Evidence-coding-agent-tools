---
name: data2evidence-code-rag
description: Deprecated legacy wrapper for maintaining or explicitly using the Data2Evidence local Qdrant code RAG. Do not use for normal Data2Evidence codebase search, implementation lookup, route/config/type/service discovery, or code changes; use direct source inspection with rg and matching subsystem skills instead. Only load this skill when the user explicitly asks for the legacy code-rag tool, Qdrant index, snapshots, embedding setup, or RAG maintenance.
---

# Data2Evidence Code RAG (Deprecated Codex Wrapper)

This is the Codex-specific wrapper for skill discovery.

Canonical instructions live in:

`skills/data2evidence-code-rag/SKILL.md`

When this skill triggers, load and follow that shared skill file (and its referenced files) as the source of truth.
