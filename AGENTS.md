# Agent Instructions

This repository contains companion tooling for coding agents working on Data2Evidence.

## Default Approach

Prefer running tools, services, tests, and experiments inside Docker containers when practical.

The goal is to reduce dependency drift, local system setup differences, and hidden assumptions about a developer's machine. If a tool needs Python, Node, databases, model runtimes, CLIs, or service dependencies, prefer encoding those requirements in a `Dockerfile`, `docker-compose.yml`, or documented container command.

## Repository Shape

- `tools/`: standalone agent tools, such as code RAG or repo analysis utilities
- `skills/`: Codex/agent skills for Data2Evidence workflows
- `repos/`: local checkouts and user-specific working material (for example, Data2Evidence and personal docs in `repos/docs/`)
- `lima/`: local VM/container setup notes and configs

## Tooling Guidelines

- Keep tools isolated from the main `Data2Evidence` repo unless integration is intentional.
- Make the Data2Evidence repo path configurable instead of hardcoding user-specific paths.
- Prefer small, reproducible entrypoints such as `docker compose run`, `make`, or a documented CLI command.
- Store generated indexes, databases, caches, and model artifacts outside source-controlled paths or under ignored directories.
- Do not index or persist secrets, `.env*` files, credentials, certificates, or generated private keys.
- Keep allowlists tight when scanning the Data2Evidence repo.
- Add lightweight tests for filtering, path handling, and metadata behavior when a tool reads source files.

## Documentation Expectations

- Keep `README.md` and tool-level READMEs in sync when workflows, paths, or commands change.
- Document both the quick path (`make ...`) and the underlying container command when possible.
- Prefer concrete examples that can be copy/pasted by another developer.
- Use `repos/docs/` for personal docs; this may be a normal local folder or a separate personal Git repository.

## Local Execution

When local execution is simpler for a quick check, it is fine to run it directly, but document the container path as the durable workflow.

If a command fails because of missing local dependencies, prefer adding or improving container setup before asking users to install packages globally.
