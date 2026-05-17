# Data2Evidence Coding Agent Tools

Companion tooling for working on Data2Evidence with coding agents.

This repository is intentionally separate from `Data2Evidence` so experiments can move quickly without coupling every tool to the application repo. Tools can graduate into Data2Evidence later if they become part of the product or developer workflow.

## Layout

```text
tools/
  code-rag/        # Repository-aware RAG over Data2Evidence code and docs
lima/             # Future local VM/container setup
skills/           # Future Codex/agent skills for D2E workflows
docs/             # Notes and tool plans
```

## Current Tools

- [Code RAG](tools/code-rag/README.md): local Qdrant-backed retrieval over Data2Evidence source files with citations.

