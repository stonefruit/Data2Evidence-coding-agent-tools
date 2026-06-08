# Knowledge Progressive Disclosure Plan

This folder is the source-controlled knowledge layer for Data2Evidence coding agents.

The goal is to preserve durable, reusable knowledge without turning the repository into a large documentation dump. Agents should discover knowledge gradually, starting from `AGENTS.md`, then matching skills, then a small knowledge index, and only then loading specific knowledge files.

## Goals

- Keep durable D2E knowledge close to agent workflow instructions.
- Make knowledge discoverable through a clear progressive disclosure tree.
- Keep individual knowledge files small, plain, and easy to verify.
- Keep knowledge shallow by default; include deeper logic only when there is a clear durable reason.
- Avoid frontmatter-driven discovery, because unloaded files cannot help an agent decide whether to load them.
- Use Git history as the trust and freshness trail for knowledge files.

## Non-Goals

- Do not copy the old `repos/docs/knowledge` folder into this folder as-is.
- Do not store personal notes, scratch findings, or one-off task context here.
- Do not treat knowledge files as a replacement for source code, tests, or runtime verification.
- Do not require per-file frontmatter.
- Do not make agents scan the entire `knowledge/` tree by default.
- Do not explain implementation logic in depth when the code is the better source of truth.

## Progressive Disclosure Tree

```text
AGENTS.md
  -> skills/<matching-skill>/SKILL.md
      -> knowledge/INDEX.md
          -> knowledge/<category>/<specific-topic>.md
              -> source code, tests, runtime behavior, or official docs for verification
```

Each layer has a different job:

- `AGENTS.md` tells agents that this knowledge layer exists and when to consult it.
- `skills/` tells agents which knowledge areas are relevant to a workflow.
- `knowledge/INDEX.md` is the routing map.
- Individual knowledge files contain the actual reusable facts, patterns, and caveats.
- Source code and tests remain the final authority.

## Proposed Folder Shape

```text
knowledge/
  README.md
  INDEX.md
  architecture/
  decisions/
  patterns/
  qa/
  troubleshooting/
  workflows/
```

Recommended category use:

- `architecture/`: how major D2E systems fit together.
- `decisions/`: durable architectural or workflow decisions and their rationale.
- `patterns/`: reusable implementation patterns.
- `qa/`: expected behavior, false positives, and repeatable verification notes.
- `troubleshooting/`: recurring symptoms, causes, and fixes.
- `workflows/`: durable procedures that are not already better represented as skills.

If a document mostly tells an agent how to perform a task, prefer putting that procedure in `skills/` or a skill reference file. If a document mostly records facts about D2E, keep it in `knowledge/`.

## Discovery Model

Agents should not inspect every knowledge file before working. They should:

1. Read `AGENTS.md`.
2. Load the matching skill for the task.
3. Open `knowledge/INDEX.md` only when the skill or task suggests reusable D2E context may matter.
4. Load only the specific knowledge files selected by the index.
5. Verify high-impact or stale-looking claims against source code, tests, runtime behavior, or reliable docs.

The index is the map. Individual files are the payload.

## Index Format

`knowledge/INDEX.md` should stay short and route-oriented. It should describe when to load a file, not repeat the file.

Example:

```md
# Knowledge Index

## QA

### Cohorts Expected Behavior

Read `qa/cohorts-expected-behavior.md` when:
- verifying Cohorts or Patient Analytics UI behavior
- reviewing QA findings for false positives
- testing chart filtering, concept set dropdowns, or age chips

## Architecture

### Portal App Architecture

Read `architecture/portal.md` when:
- changing portal routing
- debugging micro-frontend loading
- working with single-spa plugin integration
```

Good index entries include:

- the file path
- short load conditions
- important keywords a task might mention
- related skills when helpful

The index should avoid:

- long explanations
- code snippets
- duplicated knowledge
- status tables that require frequent manual cleanup

## Knowledge File Format

Knowledge files are plain Markdown with no required frontmatter.

Recommended structure:

```md
# Clear Topic Name

## Read When

- Concrete trigger for loading this file.
- Another concrete trigger.

## Summary

Short explanation of the durable lesson.

## Facts

- Specific fact or rule.
- Specific caveat or pitfall.
- Specific path, command, or behavior when useful.

## Evidence

How this was verified, or what evidence originally established it.

## Recheck When

- Source paths change.
- Related runtime behavior changes.
- A task depends on this being exactly correct.

## Related

- `skills/example-skill/SKILL.md`
- `knowledge/other-category/related-topic.md`
```

The most important sections are `Read When`, `Facts`, `Evidence`, and `Recheck When`.

## Depth Rule

Knowledge files should orient agents, not recreate the codebase in prose. Deeper implementation logic should usually be found by inspecting the referenced source paths.

Prefer:

- concise facts
- decision points
- pitfalls and expected behavior
- source paths to inspect next
- verification notes

Avoid:

- long code walkthroughs
- broad subsystem tutorials
- detailed implementation logic that is clear from nearby source code
- duplicated explanations from official docs or existing README files

Include deeper logic only when it has durable value, such as:

- explaining a non-obvious behavior that has caused repeated bugs
- documenting a cross-service interaction that is hard to infer from one file
- capturing rationale behind a decision that future agents may otherwise undo
- describing expected behavior that looks like a bug during QA

When deeper logic is needed for a task, the knowledge file should point to the right code and describe what to inspect. It should only explain the logic itself when source inspection alone is unlikely to reveal the important lesson.

## Trust And Freshness

Knowledge committed under `knowledge/` is considered curated. Unverified or speculative notes should stay outside this folder until they are checked.

Use Git to inspect freshness:

```bash
git log -1 --format='%cs %h %s' -- knowledge/<path>.md
git blame knowledge/<path>.md
```

This means a knowledge file does not need `status`, `last_verified`, or `updated_at` frontmatter. The latest relevant commit is the verification trail.

Agents should still recheck claims when:

- the source code has changed since the knowledge file was last touched
- the claim affects a risky implementation decision
- the knowledge file itself says to recheck for the current scenario
- runtime behavior contradicts the document

## What Belongs Here

Good candidates:

- recurring pitfalls that save debugging time
- expected behavior that prevents false-positive bug reports
- architecture summaries that help agents choose the right files
- D2E-specific implementation patterns
- durable workflow decisions and rationale

Poor candidates:

- one-off bug fixes
- task notes
- personal preferences
- temporary workarounds
- generic framework documentation
- content that has not been verified

## Keeping Knowledge In Sync

Use this lightweight workflow when adding or changing knowledge:

1. Confirm the knowledge is reusable beyond the current task.
2. Verify it against code, tests, runtime behavior, or reliable docs.
3. Add or update a short file under the right category.
4. Update `knowledge/INDEX.md` with load conditions.
5. Commit the knowledge change with a clear message.

When a knowledge file becomes outdated:

1. Update it if the replacement knowledge is known.
2. Move obsolete historical content into a short note only if it is still useful.
3. Delete it if it no longer helps future agents.
4. Update `knowledge/INDEX.md`.

## Skill Integration

Skills should point to the index or to specific knowledge files only when that context is likely to matter.

Examples:

- `verify-ui` can tell agents to check `knowledge/INDEX.md` for QA and troubleshooting entries before reporting UI bugs.
- `cohorts-dev` can point directly to Cohorts expected behavior knowledge when verifying Patient Analytics.
- `prd` and `breakdown` can tell agents to check architecture and decision entries before planning larger work.
- `quickfix` can tell agents to check troubleshooting entries only when the symptom matches.

Skill files should not duplicate knowledge content. They should only route to it.

## Initial Adoption Checklist

- [x] Add this `knowledge/README.md`.
- [x] Add a small `knowledge/INDEX.md` with empty category headings and usage guidance.
- [x] Add category folders with `.gitkeep` files.
- [x] Update `AGENTS.md` to describe the knowledge progressive disclosure tree.
- [x] Update relevant skills so they consult `knowledge/INDEX.md` or specific knowledge files at the right time.
- [ ] Add only a few high-confidence knowledge files first.
- [ ] Review the old `repos/docs/knowledge` content selectively and rewrite useful pieces into the new format.
- [ ] Add a lightweight validation script later if manual upkeep becomes noisy.

## Future Validation

A future `knowledge-check` command can verify:

- every linked file in `knowledge/INDEX.md` exists
- every Markdown file under `knowledge/` is reachable from the index, except this README
- no knowledge file is excessively large
- no ignored `repos/` archive paths are referenced as durable knowledge
- category folders match the agreed folder shape

The validator should support the workflow without forcing frontmatter or complex metadata.
