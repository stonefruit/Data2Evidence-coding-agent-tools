# Agent Instructions

This repository contains companion tooling for coding agents working on Data2Evidence.

## Default Approach

Prefer running tools, services, tests, and experiments inside Docker containers when practical.

The goal is to reduce dependency drift, local system setup differences, and hidden assumptions about a developer's machine. If a tool needs Python, Node, databases, model runtimes, CLIs, or service dependencies, prefer encoding those requirements in a `Dockerfile`, `docker-compose.yml`, or documented container command.

## Repository Shape

- `tools/`: standalone agent tools, such as repo analysis utilities
- `skills/`: shared Data2Evidence workflow skills used by multiple coding agents
- `knowledge/`: source-controlled durable D2E knowledge, discovered progressively through `knowledge/INDEX.md`
- `.codex/skills/`, `.claude/skills/`, `.opencode/skills/`: thin agent-specific adapters that point back to `skills/`
- `repos/`: local checkouts and user-specific working material
- `repos/docs/`: personal or team docs, usually a separate Git repository and ignored by this repo
- `lima/`: local VM/container setup notes and configs

## Skill-First Rule

- Before running repository searches or answering codebase-location questions, identify and load any matching skill `SKILL.md` first.
- If a requested skill workflow is blocked (for example, Docker permissions), stop and ask the user whether to unblock it or choose another path.

## Tooling Guidelines

- Keep tools isolated from the main `Data2Evidence` repo unless integration is intentional.
- Make the Data2Evidence repo path configurable instead of hardcoding user-specific paths.
- Prefer workspace-relative paths such as `repos/Data2Evidence`, `repos/docs`, and `tools/<tool-name>`.
- When a script must cross repository boundaries, default to relative paths and allow overrides such as `D2E_WORKSPACE_ROOT`, `D2E_APP_REPO`, and `D2E_DOCS_REPO`.
- Prefer small, reproducible entrypoints such as `docker compose run`, `make`, or a documented CLI command.
- Store generated indexes, databases, caches, and model artifacts outside source-controlled paths or under ignored directories.
- Do not index or persist secrets, `.env*` files, credentials, certificates, or generated private keys.
- Keep allowlists tight when scanning the Data2Evidence repo.
- Add lightweight tests for filtering, path handling, and metadata behavior when a tool reads source files.

## Cross-Agent Workflow Policy

- Canonical reusable workflows live in `skills/<workflow>/SKILL.md`.
- Codex, Claude, and OpenCode adapters should be thin pointers to the canonical skill.
- When changing coding-agent setup, skills, commands, adapters, or workflow names, consider all included coding agents (Codex, Claude, and OpenCode) and keep their references aligned unless a difference is intentional and documented.
- Do not duplicate long workflow instructions across agent-specific command or skill files.
- Move fragile shell procedures into `scripts/` or tool directories instead of embedding them in prompts.
- If an adapter needs tool-specific behavior, keep it short and explain why it cannot live in the shared skill.

## Knowledge Progressive Disclosure

- Shared durable knowledge lives in `knowledge/`.
- Treat `knowledge/INDEX.md` as the routing map; do not scan every knowledge file by default.
- Load only knowledge files whose route conditions match the current task.
- Keep knowledge files shallow by default: concise facts, expected behavior, pitfalls, source paths, and verification notes.
- Prefer inspecting source code for deeper implementation logic unless prose captures durable rationale or a non-obvious lesson.
- Use Git history as the edit trail, and record the source commit each knowledge file was verified against.

## Documentation Expectations

- Keep `README.md` and tool-level READMEs in sync when workflows, paths, or commands change.
- Document both the quick path (`make ...`) and the underlying container command when possible.
- Prefer concrete examples that can be copy/pasted by another developer.
- Do not post investigation notes, status updates, summaries, or comments directly to GitHub issues or pull requests unless the user explicitly asks for that GitHub update.
- Use `knowledge/` for source-controlled durable agent knowledge.
- Use `repos/docs/` for personal or team docs; this may be a normal local folder or a separate personal Git repository.
- Prefer documenting project investigations, issue notes, PR context, and working summaries in `repos/docs/` by default.
- Ignore `repos/docs/archive/` by default unless the user explicitly asks for archived material.
- Do not write durable knowledge to `knowledge/` without following the `maint-knowledge-curator` skill.
- Do not edit `human-notes.md`; write brief companion notes to `human-notes-responses.md` if needed.

## Personal Instructions

- When working in a user-specific checkout, check for `repos/docs/MY_AGENT.md` and follow any personal preferences there in addition to these shared instructions.

## Local Execution

When local execution is simpler for a quick check, it is fine to run it directly, but document the container path as the durable workflow.

If a command fails because of missing local dependencies, prefer adding or improving container setup before asking users to install packages globally.
