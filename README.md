# Data2Evidence Coding Agent Tools

Companion tooling for working on Data2Evidence with coding agents.

This repository is intentionally separate from `Data2Evidence` so experiments can move quickly without coupling every tool to the application repo. Tools can graduate into Data2Evidence later if they become part of the product or developer workflow.

## Working Style

- Prefer Docker-first commands for tooling, indexing, and tests.
- Keep Data2Evidence path configuration explicit and portable.
- Keep generated artifacts and model files out of source control.
- Keep shared durable agent knowledge in `knowledge/`.
- Keep personal/team documentation in `repos/docs/`, which may be a separate local Git repository.

For shared conventions, see [AGENTS.md](AGENTS.md).

## Getting Started

Use this repository as the parent workspace for agent tools and local D2E
checkouts.

1. Clone this repository and enter it:

   ```sh
   git clone <d2e-agent-tools-repo-url> d2e
   cd d2e
   ```

2. Add the local repositories at the expected workspace paths:

   ```sh
   mkdir -p repos
   git clone <Data2Evidence-repo-url> repos/Data2Evidence
   git clone <docs-repo-url> repos/docs
   ```

   If your documentation source is not a Git repository, copy it into
   `repos/docs`. The source repository or folder can have any name before it is
   copied; inside this workspace the default expected location is `repos/docs`.
   If it must live elsewhere, set `D2E_DOCS_REPO` to that path.

3. Make sure `repos/docs` has the folders that shared workflows expect:

   ```text
   repos/docs/
     projects/
     templates/
     knowledge/
     archive/
   ```

4. For the default setup, confirm the important paths exist:

   ```sh
   test -d repos/Data2Evidence
   test -d repos/docs/projects
   test -d skills
   test -d knowledge
   ```

5. Read [AGENTS.md](AGENTS.md) before asking an agent to work in the
   workspace. Agents use it as the shared operating guide.

Most skills and scripts assume these workspace-relative paths. If a checkout
must live somewhere else, set an override such as `D2E_APP_REPO` or
`D2E_DOCS_REPO`, but the default and best-supported setup is to use
`repos/Data2Evidence` and `repos/docs`.

## Repository Layout

```text
tools/            # Standalone agent tools, including legacy experiments
skills/           # Shared skill instructions reusable across harnesses
knowledge/        # Source-controlled durable knowledge, routed through INDEX.md
.codex/skills/    # Codex-specific skill wrappers/frontmatter and UI metadata
.claude/          # Claude-specific thin adapters
.opencode/        # OpenCode-specific thin adapters
repos/            # Local checkouts used by tools (e.g., Data2Evidence)
repos/docs/       # Personal docs (normal local folder or separate personal Git repo)
lima/             # Local VM/container setup notes
```

The workspace-relative folder names are the default local contract. The
upstream repository names do not need to match these folder names, but the
checkout or copy should usually live at the expected path because skills,
scripts, and agent instructions refer to those paths. If a checkout must live
elsewhere, use the supported overrides such as `D2E_APP_REPO` or
`D2E_DOCS_REPO`.

## Skill Packaging Pattern

- Keep canonical skill instructions in `skills/<skill-name>/SKILL.md`.
- Keep Codex discovery wrappers in `.codex/skills/<skill-name>/SKILL.md`.
- Keep Claude discovery wrappers in `.claude/skills/<skill-name>/SKILL.md`.
- Keep OpenCode discovery wrappers in `.opencode/skills/<skill-name>/SKILL.md`.
- Keep adapter files thin; they should point to the shared `skills/` instructions as source of truth.

## Knowledge Pattern

- Keep curated reusable D2E knowledge in `knowledge/`.
- Start discovery from `knowledge/INDEX.md`; load only files whose route conditions match the task.
- Keep knowledge files plain Markdown with no required frontmatter.
- Keep knowledge shallow by default: facts, pitfalls, expected behavior, source paths, and verification notes.
- Use Git history as the edit trail, record the source commit each knowledge file was verified against, and verify risky claims against source code, tests, or runtime behavior.

## Local Repositories

The main `d2e` repo ignores `repos/` so each developer can use their own local checkouts:

- `repos/Data2Evidence`: main application checkout.
- `repos/docs`: personal or team documentation checkout.
- `repos/e2e`: optional isolated checkout for E2E runs.

These paths are the default stable interface. The source repository may have a
different name, but once cloned or copied into this workspace it should usually
use the folder name above. Scripts and skills should use relative paths by
default and allow overrides with environment variables such as `D2E_APP_REPO`
and `D2E_DOCS_REPO`. Shared durable knowledge belongs in `knowledge/`; local or
personal docs belong in `repos/docs` unless `D2E_DOCS_REPO` points elsewhere.

The expected `repos/docs` layout is:

```text
repos/docs/
  README.md        # Local docs-repo overview
  AGENTS.md        # Optional docs-repo agent guidance
  MY_AGENT.md      # Optional personal local preferences
  projects/        # Issue notes, PRDs, implementation plans, reports
  templates/       # Reusable document templates
  knowledge/       # Local/team notes; curate durable shared facts into ../knowledge/
  archive/         # Historical material; ignored unless explicitly requested
```

## Current Tools

- [MRI Query Codec](tools/mri-query-codec/package.json): dependency-free Node helper for compressed MRI query payloads.
- [D2E OpenAPI Spec](tools/d2e-openapi-spec/package.json): dependency-free Node generator for source-derived OpenAPI specs in [docs/openapi](docs/openapi).
