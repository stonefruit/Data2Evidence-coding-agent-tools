# Knowledge Index

This index is the routing map for source-controlled D2E knowledge.

Use it after `AGENTS.md` and the matching skill indicate that durable D2E context may matter. Do not scan every file under `knowledge/` by default. Load only the specific files whose route conditions match the task.

Knowledge files are plain Markdown. They do not require frontmatter. Git history is the freshness and trust trail.

## How To Use This Index

1. Find the category that matches the task.
2. Read the route conditions under that category.
3. Open only the linked knowledge files that match the current task.
4. Treat source code, tests, runtime behavior, and reliable docs as the final authority.

## Entry Template

Use this shape when adding an entry:

```md
### Topic Name

Read `category/topic-name.md` when:
- the task mentions a concrete trigger
- the work touches a known source area
- the symptom matches a recurring issue

Related skills:
- `skills/example/SKILL.md`

Keywords:
- keyword-one
- keyword-two
```

## Architecture

Use architecture knowledge for system shape, ownership boundaries, routing, integration points, and non-obvious interactions between major D2E components.

No entries yet.

## Decisions

Use decision knowledge for durable rationale: why a pattern, architecture, workflow, or constraint exists and when it should be revisited.

No entries yet.

## Patterns

Use pattern knowledge for reusable D2E implementation conventions that are easier to follow after a short orientation.

No entries yet.

## QA

Use QA knowledge for expected behavior, false positives, and repeatable verification notes.

No entries yet.

## Troubleshooting

Use troubleshooting knowledge when the task symptom matches a known recurring failure mode or debugging path.

No entries yet.

## Workflows

Use workflow knowledge for durable procedures that do not belong in a skill or skill reference file.

No entries yet.

## Maintenance

When adding or changing knowledge:

1. Confirm the information is reusable beyond the current task.
2. Verify it against code, tests, runtime behavior, or reliable docs.
3. Add or update a short knowledge file in the right category.
4. Add or update a route entry in this index.
5. Keep deeper implementation logic in source code unless prose adds durable value.
