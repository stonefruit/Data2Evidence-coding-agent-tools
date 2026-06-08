# Knowledge Index

This index is the routing map for source-controlled D2E knowledge.

Use it after `AGENTS.md` and the matching skill indicate that durable D2E context may matter. Do not scan every file under `knowledge/` by default. Load only the specific files whose route conditions match the task.

Knowledge files are plain Markdown. They do not require frontmatter. Git history records when knowledge changed; each knowledge file should record which source commit it was verified against.

## How To Use This Index

1. Find the topic or type that matches the task.
2. Read the route conditions under that entry.
3. Open only the linked knowledge files that match the current task.
4. Treat source code, tests, runtime behavior, and reliable docs as the final authority.

## Entry Template

Use this shape when adding an entry:

```md
### Topic Name

Type: architecture | decision | pattern | qa | troubleshooting | workflow

Read `topic-name.md` when:
- the task mentions a concrete trigger
- the work touches a known source area
- the symptom matches a recurring issue

Related skills:
- `skills/example/SKILL.md`

Keywords:
- keyword-one
- keyword-two
```

## Topics

Knowledge topics live at the top level of `knowledge/` by default. Use the `Type` field to group them conceptually, and add subfolders only after a real cluster of related files makes the flat list hard to scan.

### CDM Config

Type: architecture

Read `cdm-config.md` when:
- the task mentions CDM config, Clinical Data Model config, CDW config, or `HC/HPH/CDW`
- work touches Patient Analytics filters, cohorts, domain values, query generation, or backend data model behavior
- work changes the CDM configuration frontend, validation, activation, assignment, or table placeholder mapping

Related skills:
- `skills/cohorts-dev/SKILL.md`

Keywords:
- CDM config
- Clinical Data Model
- CDW
- Patient Analytics
- `getBackendConfig`
- `advancedSettings.tableMapping`

### Cohort Builders

Type: architecture

Read `cohort-builder.md` when:
- the task mentions the main cohort builder, Patient Analytics, PA-Atlas, Atlas cohort definitions, or `ui/apps/vue-mri-ui-lib`
- work touches Patient Analytics filter cards, `plugins/ui/apps/vue-mri-ui-lib/src/query-filter`, or Atlas cohort-definition integration
- debugging filter-card state, cohort definition import/export, concept-set resolution, cohort generation, inclusion reports, or Patient Analytics bookmark integration

Related skills:
- `skills/cohorts-dev/SKILL.md`

Keywords:
- cohort builder
- Patient Analytics
- filter cards
- PA-Atlas
- Atlas cohort definition
- `query-filter`
- `QueryFilterModern`
- `QueryFilterCriteriaManager`
- `usePaAtlas`

### single-spa Portal Integration

Type: architecture

Read `single-spa.md` when:
- the task mentions single-spa, micro-frontends, import maps, SystemJS, `import-map-overrides`, or plugin apps
- work touches portal plugin loading, Researcher/System Admin/ETL plugin routes, or `type: "app"` plugin configuration
- a plugin app fails to mount, mounts in the wrong container, receives stale props, or ignores a local override URL

Related skills:
- `skills/concept-sets-dev/SKILL.md`
- `skills/cohorts-dev/SKILL.md`

Keywords:
- single-spa
- SystemJS
- import-map-overrides
- micro-frontend
- `SingleSpaAppContainer`
- `registerSingleSpaApp`

## Maintenance

When adding or changing knowledge:

1. Confirm the information is reusable beyond the current task.
2. Verify it against code, tests, runtime behavior, or reliable docs.
3. Record the source repository commit or commits in the knowledge file's `Evidence` section.
4. Add or update a short top-level knowledge file with an appropriate `Type` in this index.
5. Add or update a route entry in this index.
6. Keep deeper implementation logic in source code unless prose adds durable value.
