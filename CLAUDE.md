# Claude Adapter

@AGENTS.md

Claude-specific behavior belongs here only when it cannot live in shared policy or shared skills.

## Shared Workflows

Use the canonical workflow skills in `skills/`. Claude command wrappers under `.claude/commands/` should stay thin and point back to those shared skills.

## Commit Messages

Do not add tool co-author trailers unless the user explicitly asks for them.
