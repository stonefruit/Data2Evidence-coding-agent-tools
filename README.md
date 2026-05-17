# Data2Evidence Coding Agent Tools

Companion tooling for working on Data2Evidence with coding agents.

This repository is intentionally separate from `Data2Evidence` so experiments can move quickly without coupling every tool to the application repo. Tools can graduate into Data2Evidence later if they become part of the product or developer workflow.

## Working Style

- Prefer Docker-first commands for tooling, indexing, and tests.
- Keep Data2Evidence path configuration explicit and portable.
- Keep generated artifacts and model files out of source control.

For shared conventions, see [AGENTS.md](AGENTS.md).

## Repository Layout

```text
tools/            # Standalone agent tools (for example code-rag)
skills/           # Codex/agent skills for Data2Evidence workflows
repos/            # Local checkouts used by tools (e.g., Data2Evidence)
repos/docs/       # Personal docs (normal local folder or separate personal Git repo)
lima/             # Local VM/container setup notes
```

## Current Tools

- [Code RAG](tools/code-rag/README.md): local Qdrant-backed retrieval over Data2Evidence source files with citations.

## Quick Start (Code RAG)

```bash
cd tools/code-rag
cp .env.example .env
make qdrant
make config
make sync
make query q="Where are Azure OpenAI environment variables configured?"
```

This flow runs the app and Qdrant in Docker and uses the configured Data2Evidence checkout from `repos/`.

For full setup, embedding server options, snapshot import/export, and API usage, see [tools/code-rag/README.md](tools/code-rag/README.md).
