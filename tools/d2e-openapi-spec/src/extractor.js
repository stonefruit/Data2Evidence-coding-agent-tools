import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".mjs", ".cjs"]);
const SKIP_PARTS = new Set(["node_modules", "dist", "build", ".devServer", "coverage"]);
const SKIP_PATH_SNIPPETS = ["/lib/vendor/", "/lib/thirdparty/", "/src/lib/vendor/", "/public/"];

const KNOWN_PREFIXES = [
  "analytics-svc",
  "backend",
  "backend/api",
  "code-suggestion",
  "concept-mapping",
  "data-mapping",
  "demo",
  "d2e-webapi",
  "files-manager/api",
  "fhir-gateway",
  "gateway/api/db",
  "gateway/api",
  "hc/hph/cdw/config/services",
  "hc/hph/cdw/services",
  "hc/hph/config/services",
  "jobplugins",
  "mcp",
  "perseus",
  "parquet-export",
  "pa-config-svc",
  "prefect/d2e",
  "portal/translations",
  "public-webapi-proxy",
  "resources/concept-mapping",
  "resources/concept-sets",
  "strategus/analysis",
  "strategus/template",
  "strategus-results",
  "system-portal/notebook",
  "system-portal",
  "terminology",
  "trex",
  "usermgmt/api",
  "white-rabbit/api"
];

const PATH_DESCRIPTION_RULES = [
  {
    test: (pathKey) => pathKey === "/d2e-webapi/source/sources",
    description:
      "Lists WebAPI/Atlas-compatible sources for PA-Atlas. Source identifiers are compatibility values derived from portal datasets."
  },
  {
    test: (pathKey) => pathKey.startsWith("/d2e-webapi/conceptset"),
    description:
      "Manages local concept sets used by PA-Atlas import, export, save, and cohort-definition flows. Save/export flows load full concept-set details, not only ids."
  },
  {
    test: (pathKey) => pathKey.startsWith("/d2e-webapi/cohortdefinition/") && pathKey.includes("/report/"),
    description:
      "UI-called PA-Atlas inclusion-report endpoint. No matching d2e-webapi backend route was found in the traced source, so this is currently documented as UI-used and handler-unresolved."
  },
  {
    test: (pathKey) => pathKey.startsWith("/d2e-webapi/cohortdefinition"),
    description:
      "Creates, retrieves, updates, deletes, copies, validates, and generates PA-Atlas/OHDSI Atlas cohort definitions stored as user artifacts and embedded in Patient Analytics."
  },
  {
    test: (pathKey) => pathKey.startsWith("/d2e-webapi/vocabulary"),
    description:
      "Resolves and searches OMOP vocabulary concepts for the selected dataset. Backend handlers use the datasetid header to select the dataset/CDM context."
  },
  {
    test: (pathKey) => pathKey.startsWith("/d2e-webapi/cdmresults"),
    description:
      "Returns concept record counts for the selected dataset. The sourceKey path value is accepted for Atlas compatibility, while datasetid drives backend lookup."
  },
  {
    test: (pathKey) => pathKey === "/d2e-webapi/notifications",
    description: "Returns d2e-webapi notifications. The current backend implementation returns an empty list."
  },
  {
    test: (pathKey) => pathKey.startsWith("/analytics-svc/api/services/query"),
    description:
      "Generates SQL/query payloads from Patient Analytics filter-card and IFR requests using the active backend CDM configuration."
  },
  {
    test: (pathKey) => pathKey.startsWith("/analytics-svc/api/services/values"),
    description:
      "Returns Patient Analytics domain values for a CDM attribute path using the active backend CDM configuration and selected dataset."
  },
  {
    test: (pathKey) => pathKey === "/pa-config-svc/services/config.xsjs",
    description:
      "Action-multiplexed Patient Analytics config endpoint. The backend dispatches by request action through MriConfigFacade."
  },
  {
    test: (pathKey) => pathKey === "/hc/hph/cdw/config/services/config.xsjs",
    description:
      "Action-multiplexed CDW config endpoint. getBackendConfig returns reduced backend config used by analytics and query generation."
  },
  {
    test: (pathKey) => pathKey === "/hc/hph/cdw/services/cdw_services.xsjs",
    description: "Action-multiplexed CDW service endpoint. The backend dispatches by the action query parameter."
  }
];

const PLACEHOLDER_BACKEND_RULES = [
  {
    method: "post",
    path: "/d2e-webapi/conceptset/check",
    note: "Backend placeholder: returns { warnings: [] } without running concept-set validation."
  },
  {
    method: "post",
    path: "/d2e-webapi/cohortdefinition/sql",
    note: "Backend placeholder: route exists but does not generate SQL."
  },
  {
    method: "get",
    path: "/d2e-webapi/cohortdefinition/{id}/info",
    note: "Backend placeholder: returns static compatibility info."
  },
  {
    method: "get",
    path: "/d2e-webapi/cohortdefinition/{id}/version",
    note: "Backend placeholder: returns static compatibility version data."
  },
  {
    method: "get",
    path: "/d2e-webapi/notifications",
    note: "Backend placeholder: returns an empty notification list and ignores notification filters."
  }
];

const TAG_DESCRIPTIONS = new Map([
  ["ui-used", "Operation is called by at least one Data2Evidence UI."],
  ["backend-implemented", "A backend route declaration was found for this operation."],
  ["backend-only", "A backend route exists, but no current UI call was found."],
  ["backend-missing", "A UI call was found, but backend tracing did not find a matching route."],
  ["handler-found", "The backend route was traced to a concrete controller/router handler."],
  ["handler-unresolved", "The route is known from UI or route metadata, but no concrete backend handler was found."]
]);

const EXAMPLE_DATASET_ID = "4f05abcf-36d6-4e88-a44d-ad1ee3a0b06e";
const EXAMPLE_CONCEPT_ID = 100001;
const EXAMPLE_CHILD_CONCEPT_ID = 100002;
const EXAMPLE_COHORT_ID = 200001;
const EXAMPLE_SOURCE_KEY = EXAMPLE_DATASET_ID;
const EXAMPLE_USER_ID = "example.user";
const EXAMPLE_TENANT_ID = "f2a4a029-2b73-4d45-9c7a-4127571df0a1";
const EXAMPLE_STUDY_ID = "example-study";
const EXAMPLE_FLOW_ID = "example-flow";
const EXAMPLE_FLOW_RUN_ID = "example-flow-run";
const EXAMPLE_RELEASE_ID = "example-release";
const EXAMPLE_RESOURCE_ID = "example-resource";
const EXAMPLE_DATABASE_CODE = "example_database";
const EXAMPLE_SCHEMA_NAME = "example_schema";
const EXAMPLE_CONCEPT = {
  conceptId: EXAMPLE_CONCEPT_ID,
  display: "Example condition",
  domainId: "Condition",
  vocabularyId: "EXAMPLE",
  conceptClassId: "Example Class",
  standardConcept: "S",
  code: "EXAMPLE-001"
};
const EXAMPLE_FILTER = {
  conceptClassId: ["Example Class"],
  domainId: ["Condition"],
  vocabularyId: ["EXAMPLE"],
  standardConcept: ["S"],
  validity: []
};
const EXAMPLE_CONCEPT_SET = {
  id: 12,
  name: "Example condition set",
  description: "Synthetic concept set for API documentation examples.",
  shared: false,
  concepts: [
    {
      ...EXAMPLE_CONCEPT,
      useDescendants: true,
      useMapped: false,
      isExcluded: false
    }
  ]
};
const EXAMPLE_WEBAPI_CONCEPT = {
  CONCEPT_CLASS_ID: "Example Class",
  CONCEPT_CODE: "EXAMPLE-001",
  CONCEPT_ID: EXAMPLE_CONCEPT_ID,
  CONCEPT_NAME: "Example condition",
  DOMAIN_ID: "Condition",
  INVALID_REASON: null,
  INVALID_REASON_CAPTION: "Valid",
  STANDARD_CONCEPT: "S",
  STANDARD_CONCEPT_CAPTION: "Standard",
  VOCABULARY_ID: "EXAMPLE",
  VALID_START_DATE: "2000-01-01",
  VALID_END_DATE: "2099-12-31"
};
const EXAMPLE_WEBAPI_CONCEPT_SET_ITEM = {
  concept: EXAMPLE_WEBAPI_CONCEPT,
  isExcluded: false,
  includeDescendants: true,
  includeMapped: false
};
const EXAMPLE_WEBAPI_CONCEPT_SET = {
  createdDate: 1735689600000,
  createdBy: { name: "Example User", id: 1001, login: "example.user" },
  modifiedDate: 1735689600000,
  modifiedBy: { name: "Example User", id: 1001, login: "example.user" },
  hasWriteAccess: true,
  hasReadAccess: true,
  description: "Synthetic concept set for API documentation examples.",
  id: 12,
  name: "Example condition set",
  shared: false
};
const EXAMPLE_COHORT_DEFINITION = {
  id: EXAMPLE_COHORT_ID,
  name: "Example cohort definition",
  description: "Synthetic cohort definition for API documentation examples.",
  expressionType: "SIMPLE_EXPRESSION",
  expression: {
    ConceptSets: [{ id: 12, name: "Example condition set", expression: { items: [EXAMPLE_WEBAPI_CONCEPT_SET_ITEM] } }],
    PrimaryCriteria: { CriteriaList: [] },
    QualifiedLimit: { Type: "First" },
    ExpressionLimit: { Type: "First" },
    InclusionRules: []
  },
  createdBy: "example.user",
  createdDate: 1735689600000,
  modifiedBy: "example.user",
  modifiedDate: 1735689600000,
  tags: [],
  hasWriteAccess: true,
  hasReadAccess: true
};
const EXAMPLE_SOURCE = {
  sourceId: 1,
  sourceName: "Example dataset",
  sourceDialect: "postgresql",
  sourceKey: EXAMPLE_DATASET_ID,
  daimons: [
    {
      sourceDaimonId: 1,
      daimonType: "CDM",
      tableQualifier: "example_cdm",
      priority: 0
    }
  ]
};
const EXAMPLE_TENANT = {
  id: EXAMPLE_TENANT_ID,
  name: "Example tenant",
  system: "example"
};
const EXAMPLE_PORTAL_DATASET = {
  id: EXAMPLE_DATASET_ID,
  type: "research",
  paConfigId: "c5ff7991-5c58-4d7f-a12e-5f70bead42ce",
  tokenStudyCode: "EXAMPLE_DATASET",
  tokenDatasetCode: "EXAMPLE_DATASET",
  dialect: "postgres",
  databaseCode: "example_database",
  cacheId: "example_cache",
  schemaName: "example_cdm",
  vocabSchemaName: "example_vocab",
  dataModel: "omop",
  studyDetail: {
    id: "3a6955c2-8c69-4f74-8d8c-46038eaeec47",
    name: "Example dataset",
    description: "Synthetic dataset for API documentation examples."
  },
  datasetDetail: {
    id: "3a6955c2-8c69-4f74-8d8c-46038eaeec47",
    name: "Example dataset",
    description: "Synthetic dataset for API documentation examples.",
    summary: "Synthetic dataset summary.",
    showRequestAccess: false
  },
  tenant: EXAMPLE_TENANT,
  dashboards: [{ name: "Overview", url: "/dashboards/example", basePath: "/dashboards" }],
  attributes: [{ attributeId: "data_partner", value: "Example partner" }],
  tags: [{ id: 1, name: "Example tag" }],
  totalSubjects: 1000,
  plugin: "example"
};
const EXAMPLE_PORTAL_FEATURE = {
  feature: "datasetSearch",
  name: "Dataset search",
  nameI18nKey: "FEATURE__DATASET_SEARCH",
  isEnabled: true
};
const EXAMPLE_METADATA_ATTRIBUTE = {
  id: "data_partner",
  name: "Data partner",
  category: "dataset",
  dataType: "string",
  isDisplayed: true
};
const EXAMPLE_RESOURCE = {
  name: "example-resource.csv",
  hash: "example-hash",
  bytes: 128,
  content_type: "text/csv",
  last_modified: "2026-01-01T00:00:00.000Z"
};
const EXAMPLE_NOTEBOOK_ID = "example-notebook";
const EXAMPLE_NOTEBOOK = {
  id: EXAMPLE_NOTEBOOK_ID,
  userId: "example.user",
  name: "Example notebook",
  notebookContent: { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 },
  isShared: false
};
const EXAMPLE_CONCEPT_SET_EXPRESSION = {
  items: [EXAMPLE_WEBAPI_CONCEPT_SET_ITEM]
};
const EXAMPLE_SEARCH_BODY = {
  QUERY: "example",
  CONCEPT_CLASS_ID: ["Example Class"],
  DOMAIN_ID: ["Condition"],
  VOCABULARY_ID: ["EXAMPLE"],
  STANDARD_CONCEPT: "S",
  INVALID_REASON: ""
};

const TERMINOLOGY_EXAMPLES = new Map([
  [
    "get /terminology/fhir/4_0_0/valueset/$expand",
    {
      dropParameters: ["params"],
      parameters: [
        ["datasetId", "query", EXAMPLE_DATASET_ID],
        ["offset", "query", 0],
        ["count", "query", 25],
        ["code", "query", "example"],
        ["filter", "query", JSON.stringify(EXAMPLE_FILTER)]
      ],
      response: {
        resourceType: "ValueSet",
        expansion: {
          total: 1,
          offset: 0,
          contains: [EXAMPLE_CONCEPT]
        }
      }
    }
  ],
  [
    "get /terminology/concept/count",
    {
      dropParameters: ["params"],
      parameters: [
        ["datasetId", "query", EXAMPLE_DATASET_ID],
        ["code", "query", "example"],
        ["filter", "query", JSON.stringify(EXAMPLE_FILTER)]
      ],
      response: 42
    }
  ],
  [
    "get /terminology/concept/filter-options",
    {
      dropParameters: ["params"],
      parameters: [
        ["datasetId", "query", EXAMPLE_DATASET_ID],
        ["searchText", "query", "example"],
        ["filter", "query", JSON.stringify({ domainId: ["Condition"], standardConcept: ["S"] })]
      ],
      response: {
        filterOptions: {
          conceptClassId: [{ value: "Example Class", count: 12 }],
          domainId: [{ value: "Condition", count: 42 }],
          vocabularyId: [{ value: "EXAMPLE", count: 40 }],
          standardConcept: [{ value: "S", count: 42 }]
        }
      }
    }
  ],
  [
    "get /terminology/fhir/4_0_0/conceptmap/$translate",
    {
      parameters: [
        ["datasetId", "query", EXAMPLE_DATASET_ID],
        ["conceptId", "query", EXAMPLE_CONCEPT_ID]
      ],
      response: {
        resourceType: "Parameters",
        parameter: [
          { name: "result", valueBoolean: true },
          { name: "match", part: [{ name: "concept", valueCoding: EXAMPLE_CONCEPT }] }
        ]
      }
    }
  ],
  [
    "post /terminology/concept/searchById",
    {
      request: { datasetId: EXAMPLE_DATASET_ID, conceptId: EXAMPLE_CONCEPT_ID },
      response: EXAMPLE_CONCEPT
    }
  ],
  [
    "post /terminology/concept/searchByName",
    {
      request: { datasetId: EXAMPLE_DATASET_ID, conceptName: "Example condition" },
      response: EXAMPLE_CONCEPT
    }
  ],
  [
    "post /terminology/concept/searchByCode",
    {
      request: { datasetId: EXAMPLE_DATASET_ID, conceptCode: "EXAMPLE-001" },
      response: EXAMPLE_CONCEPT
    }
  ],
  [
    "post /terminology/concept/recommended/list",
    {
      request: { datasetId: EXAMPLE_DATASET_ID, conceptIds: [EXAMPLE_CONCEPT_ID] },
      response: [EXAMPLE_CONCEPT]
    }
  ],
  [
    "get /terminology/concept/hierarchy",
    {
      parameters: [
        ["datasetId", "query", EXAMPLE_DATASET_ID],
        ["conceptId", "query", EXAMPLE_CONCEPT_ID],
        ["depth", "query", 2]
      ],
      response: {
        concept: EXAMPLE_CONCEPT,
        parents: [],
        children: [{ ...EXAMPLE_CONCEPT, conceptId: EXAMPLE_CHILD_CONCEPT_ID, display: "Example child condition" }]
      }
    }
  ],
  [
    "post /terminology/concept/getStandardConcepts",
    {
      request: {
        datasetId: EXAMPLE_DATASET_ID,
        data: [{ sourceCode: "SRC-001", sourceName: "Example source condition" }]
      },
      response: [{ sourceCode: "SRC-001", standardConcept: EXAMPLE_CONCEPT }]
    }
  ],
  [
    "get /terminology/concept-set",
    {
      parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]],
      response: [EXAMPLE_CONCEPT_SET]
    }
  ],
  [
    "post /terminology/concept-set",
    {
      parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]],
      request: {
        name: "Example condition set",
        description: "Synthetic concept set for API documentation examples.",
        shared: false,
        concepts: EXAMPLE_CONCEPT_SET.concepts
      },
      response: 12
    }
  ],
  [
    "get /terminology/concept-set/{conceptSetId}",
    {
      parameters: [
        ["conceptSetId", "path", 12],
        ["datasetId", "query", EXAMPLE_DATASET_ID]
      ],
      response: EXAMPLE_CONCEPT_SET
    }
  ],
  [
    "put /terminology/concept-set/{conceptSetId}",
    {
      parameters: [
        ["conceptSetId", "path", 12],
        ["datasetId", "query", EXAMPLE_DATASET_ID]
      ],
      request: {
        name: "Example condition set, reviewed",
        description: "Reviewed synthetic concept set.",
        concepts: EXAMPLE_CONCEPT_SET.concepts
      },
      response: 12
    }
  ],
  [
    "delete /terminology/concept-set/{conceptSetId}",
    {
      parameters: [
        ["conceptSetId", "path", 12],
        ["datasetId", "query", EXAMPLE_DATASET_ID]
      ],
      response: 12
    }
  ]
]);

const D2E_WEBAPI_EXAMPLES = new Map([
  [
    "post /d2e-webapi/cdmresults/{datasetId}/conceptRecordCount",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["datasetId", "path", EXAMPLE_DATASET_ID]
      ],
      request: [EXAMPLE_CONCEPT_ID, EXAMPLE_CHILD_CONCEPT_ID],
      response: [{ [EXAMPLE_CONCEPT_ID]: [120, 240], [EXAMPLE_CHILD_CONCEPT_ID]: [30, 60] }]
    }
  ],
  [
    "get /d2e-webapi/source/sources",
    {
      response: [EXAMPLE_SOURCE]
    }
  ],
  [
    "get /d2e-webapi/source/daimon/priority",
    {
      response: { CDM: EXAMPLE_SOURCE, Vocabulary: EXAMPLE_SOURCE, Results: EXAMPLE_SOURCE }
    }
  ],
  [
    "get /d2e-webapi/notifications",
    {
      parameters: [
        ["hide_statuses", "query", "COMPLETED"],
        ["hideStatuses", "query", "COMPLETED"],
        ["refreshJobs", "query", false]
      ],
      response: []
    }
  ],
  [
    "get /d2e-webapi/health",
    {
      response: { status: "healthy", uptime: 12345 }
    }
  ],
  [
    "get /d2e-webapi/i18n/locales",
    {
      response: ["en"]
    }
  ],
  [
    "get /d2e-webapi/i18n",
    {
      response: { locale: "en", translations: {} }
    }
  ],
  [
    "get /d2e-webapi/conceptset",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      response: [EXAMPLE_WEBAPI_CONCEPT_SET]
    }
  ],
  [
    "post /d2e-webapi/conceptset",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      request: {
        name: "Example condition set",
        description: "Synthetic concept set for API documentation examples.",
        shared: false
      },
      response: EXAMPLE_WEBAPI_CONCEPT_SET
    }
  ],
  [
    "get /d2e-webapi/conceptset/{conceptSetId}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12]
      ],
      response: EXAMPLE_WEBAPI_CONCEPT_SET
    }
  ],
  [
    "put /d2e-webapi/conceptset/{conceptSetId}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12]
      ],
      request: {
        name: "Example condition set, reviewed",
        description: "Reviewed synthetic concept set.",
        shared: false
      },
      response: true
    }
  ],
  [
    "delete /d2e-webapi/conceptset/{conceptSetId}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12]
      ],
      responseStatus: 204
    }
  ],
  [
    "get /d2e-webapi/conceptset/{conceptSetId}/exists",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12],
        ["name", "query", "Example condition set"]
      ],
      response: 0
    }
  ],
  [
    "get /d2e-webapi/conceptset/{conceptSetId}/expression",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12],
        ["datasetId", "query", EXAMPLE_DATASET_ID]
      ],
      response: EXAMPLE_CONCEPT_SET_EXPRESSION
    }
  ],
  [
    "put /d2e-webapi/conceptset/{conceptSetId}/items",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["conceptSetId", "path", 12]
      ],
      request: [
        {
          conceptId: EXAMPLE_CONCEPT_ID,
          isExcluded: false,
          includeDescendants: true,
          includeMapped: false
        }
      ],
      response: true
    }
  ],
  [
    "post /d2e-webapi/conceptset/check",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      request: { id: 12, name: "Example condition set", expression: EXAMPLE_CONCEPT_SET_EXPRESSION },
      response: { warnings: [] }
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["source", "query", "atlas"]
      ],
      response: [EXAMPLE_COHORT_DEFINITION]
    }
  ],
  [
    "post /d2e-webapi/cohortdefinition",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      request: EXAMPLE_COHORT_DEFINITION,
      response: EXAMPLE_COHORT_DEFINITION
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{cohortDefinitionId}/info",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["cohortDefinitionId", "path", EXAMPLE_COHORT_ID]
      ],
      response: [
        {
          id: { cohortDefinitionId: EXAMPLE_COHORT_ID, sourceId: 1 },
          startTime: 1735689600000,
          executionDuration: 1200,
          status: "COMPLETE",
          isValid: true,
          isCanceled: false,
          failMessage: null,
          personCount: 100,
          recordCount: 250,
          createdBy: "example.user"
        }
      ]
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["cohortDefinitionId", "path", EXAMPLE_COHORT_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY],
        ["mode", "query", 0]
      ],
      response: {
        summary: { baseCount: 100, finalCount: 80 },
        inclusionRuleStats: [{ id: 1, name: "Example rule", personCount: 80 }],
        treemapData: []
      }
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{id}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID]
      ],
      response: EXAMPLE_COHORT_DEFINITION
    }
  ],
  [
    "put /d2e-webapi/cohortdefinition/{id}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID]
      ],
      request: EXAMPLE_COHORT_DEFINITION,
      response: { ...EXAMPLE_COHORT_DEFINITION, name: "Example cohort definition, reviewed" }
    }
  ],
  [
    "delete /d2e-webapi/cohortdefinition/{id}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID]
      ],
      responseStatus: 204
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{id}/copy",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID]
      ],
      response: { ...EXAMPLE_COHORT_DEFINITION, id: EXAMPLE_COHORT_ID + 1, name: "Copy of example cohort definition" }
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{id}/exists",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID],
        ["name", "query", "Example cohort definition"]
      ],
      response: 0
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{id}/generate/{sourceKey}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      response: {
        status: "STARTING",
        startDate: null,
        endDate: null,
        exitStatus: "UNKNOWN",
        executionId: "example-execution-id",
        jobInstance: { instanceId: "example-instance-id", name: "generateCohort" },
        jobParameters: {
          jobName: "Generate example cohort",
          generate_stats: "true",
          jobAuthor: "example.user",
          sessionId: "example-session",
          cohort_definition_id: EXAMPLE_COHORT_ID,
          source_id: "1",
          time: 1735689600000,
          target_database_schema: "example_results"
        },
        ownerType: null
      }
    }
  ],
  [
    "get /d2e-webapi/cohortdefinition/{id}/version",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["id", "path", EXAMPLE_COHORT_ID]
      ],
      response: [{ assetId: EXAMPLE_COHORT_ID, version: 1, archived: false, createdDate: 1735689600000 }]
    }
  ],
  [
    "post /d2e-webapi/cohortdefinition/checkV2",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      request: EXAMPLE_COHORT_DEFINITION,
      response: { warnings: [] }
    }
  ],
  [
    "post /d2e-webapi/cohortdefinition/sql",
    {
      parameters: [["datasetid", "header", EXAMPLE_DATASET_ID]],
      request: { expression: EXAMPLE_COHORT_DEFINITION.expression, options: {} },
      response: { templateSql: "/* synthetic SQL template */ SELECT 1;" }
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{datasetId}/concept/{conceptId}",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["datasetId", "path", EXAMPLE_DATASET_ID],
        ["conceptId", "path", EXAMPLE_CONCEPT_ID]
      ],
      response: EXAMPLE_WEBAPI_CONCEPT
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{datasetId}/search",
    {
      dropParameters: ["params"],
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["datasetId", "path", EXAMPLE_DATASET_ID],
        ["page", "query", 0],
        ["rowsPerPage", "query", 25],
        ["sortBy", "query", "CONCEPT_NAME"],
        ["sortOrder", "query", "asc"]
      ],
      request: EXAMPLE_SEARCH_BODY,
      response: [{ ...EXAMPLE_WEBAPI_CONCEPT, SCORE: 0.99 }]
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{sourceKey}/info",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      response: { version: "Example vocabulary version", dialect: "postgresql" }
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/resolveConceptSetExpression",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: EXAMPLE_CONCEPT_SET_EXPRESSION,
      response: [EXAMPLE_CONCEPT_ID, EXAMPLE_CHILD_CONCEPT_ID]
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/included-concepts/count",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: EXAMPLE_CONCEPT_SET_EXPRESSION,
      response: 2
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/lookup/identifiers",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: [EXAMPLE_CONCEPT_ID],
      response: [EXAMPLE_WEBAPI_CONCEPT]
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/lookup/identifiers/ancestors",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: { ancestors: [EXAMPLE_CONCEPT_ID], descendants: [EXAMPLE_CHILD_CONCEPT_ID] },
      response: { [EXAMPLE_CONCEPT_ID]: [EXAMPLE_CHILD_CONCEPT_ID] }
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/lookup/mapped",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: [EXAMPLE_CONCEPT_ID],
      response: [{ ...EXAMPLE_WEBAPI_CONCEPT, CONCEPT_ID: EXAMPLE_CHILD_CONCEPT_ID, CONCEPT_NAME: "Example mapped condition" }]
    }
  ],
  [
    "post /d2e-webapi/vocabulary/{sourceKey}/lookup/recommended",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      request: [EXAMPLE_CONCEPT_ID],
      response: [{ ...EXAMPLE_WEBAPI_CONCEPT, RELATIONSHIPS: ["Example relationship"] }]
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{sourceKey}/domains",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      response: [{ DOMAIN_NAME: "Condition", DOMAIN_ID: "Condition", DOMAIN_CONCEPT_ID: 100010 }]
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{sourceKey}/vocabularies",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY]
      ],
      response: [
        {
          VOCABULARY_ID: "EXAMPLE",
          VOCABULARY_NAME: "Example vocabulary",
          VOCABULARY_REFERENCE: "Synthetic documentation vocabulary",
          VOCABULARY_VERSION: "example-1",
          VOCABULARY_CONCEPT_ID: 100020
        }
      ]
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{sourceKey}/concept/{id}/related",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY],
        ["id", "path", EXAMPLE_CONCEPT_ID]
      ],
      response: [
        {
          ...EXAMPLE_WEBAPI_CONCEPT,
          RELATIONSHIPS: [{ RELATIONSHIP_NAME: "Example relationship", RELATIONSHIP_DISTANCE: 1 }],
          RELATIONSHIP_CAPTION: "Example relationship"
        }
      ]
    }
  ],
  [
    "get /d2e-webapi/vocabulary/{sourceKey}/search",
    {
      parameters: [
        ["datasetid", "header", EXAMPLE_DATASET_ID],
        ["sourceKey", "path", EXAMPLE_SOURCE_KEY],
        ["query", "query", "example"]
      ],
      response: [EXAMPLE_WEBAPI_CONCEPT]
    }
  ]
]);

const SYSTEM_PORTAL_EXAMPLES = new Map([
  ["get /system-portal/config/types", { parameters: [["types", "query", "[\"overview-description\"]"]], response: { "overview-description": "Example overview" } }],
  ["get /system-portal/config/public/types", { parameters: [["types", "query", "[\"overview-description\"]"]], response: { "overview-description": "Example overview" } }],
  ["get /system-portal/config/public/header-image", { response: { type: "header-image", value: "data:image/png;base64,EXAMPLE" } }],
  ["get /system-portal/config/public/overview-description", { response: { type: "overview-description", value: "Example overview" } }],
  [
    "put /system-portal/config",
    {
      request: [{ type: "overview-description", value: "Updated example overview" }],
      response: { updated: ["overview-description"] }
    }
  ],
  ["get /system-portal/dataset", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]], response: EXAMPLE_PORTAL_DATASET }],
  ["get /system-portal/dataset/list", { response: [EXAMPLE_PORTAL_DATASET] }],
  ["get /system-portal/dataset/list/systemadmin", { response: [EXAMPLE_PORTAL_DATASET] }],
  ["get /system-portal/dataset/public/list", { response: [EXAMPLE_PORTAL_DATASET] }],
  ["delete /system-portal/dataset", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]], response: { id: EXAMPLE_DATASET_ID } }],
  ["put /system-portal/dataset", { request: EXAMPLE_PORTAL_DATASET, response: EXAMPLE_PORTAL_DATASET }],
  ["post /system-portal/dataset/detail", { request: EXAMPLE_PORTAL_DATASET, response: EXAMPLE_PORTAL_DATASET }],
  ["put /system-portal/dataset/detail", { request: EXAMPLE_PORTAL_DATASET, response: EXAMPLE_PORTAL_DATASET }],
  ["post /system-portal/dataset/{datasetId}/transform-to-webapi", { parameters: [["datasetId", "path", EXAMPLE_DATASET_ID]], response: { sourceId: 1, sourceKey: EXAMPLE_SOURCE_KEY } }],
  ["get /system-portal/dataset/dashboard-code", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["type", "query", "overview"], ["name", "query", "main"]], response: { datasetId: EXAMPLE_DATASET_ID, type: "overview", name: "main", code: "SELECT 1" } }],
  ["put /system-portal/dataset/dashboard-code", { request: { datasetId: EXAMPLE_DATASET_ID, type: "overview", name: "main", language: "sql", code: "SELECT 1" }, response: { id: 1 } }],
  ["get /system-portal/dataset/dashboard-code-query", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["type", "query", "overview"], ["name", "query", "main"], ["queryName", "query", "example"]], response: { queryName: "example", sql: "SELECT 1" } }],
  ["put /system-portal/dataset/dashboard-code-query", { request: { datasetId: EXAMPLE_DATASET_ID, type: "overview", name: "main", queryName: "example", sql: "SELECT 1" }, response: { id: 1 } }],
  ["delete /system-portal/dataset/dashboard-code-query", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["type", "query", "overview"], ["name", "query", "main"], ["queryName", "query", "example"]], response: { id: 1 } }],
  ["get /system-portal/dataset/dashboard-codes", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["type", "query", "overview"]], response: [{ type: "overview", name: "main", code: "SELECT 1", queries: [{ queryName: "example", sql: "SELECT 1" }] }] }],
  ["get /system-portal/dataset/filter-scopes", { response: { domains: { Condition: "Condition" }, age: { min: 0, max: 100 }, observationYear: { min: 2000, max: 2026 }, cumulativeObservationMonths: { min: 0, max: 240 } } }],
  ["post /system-portal/dataset/metadata-config/attribute", { request: EXAMPLE_METADATA_ATTRIBUTE, response: EXAMPLE_METADATA_ATTRIBUTE.id }],
  ["put /system-portal/dataset/metadata-config/attribute", { request: EXAMPLE_METADATA_ATTRIBUTE, response: EXAMPLE_METADATA_ATTRIBUTE.id }],
  ["delete /system-portal/dataset/metadata-config/attribute/{id}", { parameters: [["id", "path", EXAMPLE_METADATA_ATTRIBUTE.id]], response: EXAMPLE_METADATA_ATTRIBUTE.id }],
  ["get /system-portal/dataset/metadata-config/attribute/list", { response: [EXAMPLE_METADATA_ATTRIBUTE] }],
  ["post /system-portal/dataset/metadata-config/tag", { request: { name: "Example tag" }, response: "Example tag" }],
  ["delete /system-portal/dataset/metadata-config/tag/{name}", { parameters: [["name", "path", "Example tag"]], response: "Example tag" }],
  ["get /system-portal/dataset/metadata-config/tag/list", { response: ["Example tag"] }],
  ["post /system-portal/dataset/release", { request: { datasetId: EXAMPLE_DATASET_ID, name: "Example release", releaseDate: "2026-01-01T00:00:00.000Z" }, response: { id: 1, datasetId: EXAMPLE_DATASET_ID, name: "Example release", releaseDate: "2026-01-01T00:00:00.000Z" } }],
  ["get /system-portal/dataset/release/list", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]], response: [{ id: 1, datasetId: EXAMPLE_DATASET_ID, name: "Example release", releaseDate: "2026-01-01T00:00:00.000Z" }] }],
  ["post /system-portal/dataset/resource", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]], request: { file: "example-resource.csv" }, response: EXAMPLE_RESOURCE }],
  ["delete /system-portal/dataset/resource/{filename}", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["filename", "path", EXAMPLE_RESOURCE.name]], response: { deleted: EXAMPLE_RESOURCE.name } }],
  ["get /system-portal/dataset/resource/{filename}/download", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID], ["filename", "path", EXAMPLE_RESOURCE.name]], response: { fileName: EXAMPLE_RESOURCE.name, contentType: "text/csv", contentDisposition: "attachment", data: "ZXhhbXBsZQ==" } }],
  ["get /system-portal/dataset/resource/list", { parameters: [["datasetId", "query", EXAMPLE_DATASET_ID]], response: { id: EXAMPLE_DATASET_ID, resources: [EXAMPLE_RESOURCE] } }],
  ["post /system-portal/feature", { request: { features: [EXAMPLE_PORTAL_FEATURE] }, response: { result: [{ id: 1 }] } }],
  ["get /system-portal/feature/list", { response: [EXAMPLE_PORTAL_FEATURE] }],
  ["get /system-portal/system/feature/list", { response: [EXAMPLE_PORTAL_FEATURE] }],
  ["get /system-portal/git-dashboards", { response: [{ name: "Example dashboard", path: "dashboards/example.json" }] }],
  ["get /system-portal/git-studies/studies", { response: { "example-study": { strategus_json: "strategus/example.json", description: "Example study" } } }],
  ["get /system-portal/git-studies/study/strategus", { parameters: [["studyId", "query", "example-study"]], response: { analysisSpecification: { name: "Example Strategus analysis" } } }],
  ["get /system-portal/pa-config/metadata/list", { response: [{ meta: { configId: "example-pa-config", configName: "Example PA config" } }] }],
  ["get /system-portal/tenant/list", { response: [EXAMPLE_TENANT] }],
  ["get /system-portal/notebook", { response: [EXAMPLE_NOTEBOOK] }],
  ["get /system-portal/notebook/templates", { response: [{ id: "example-template", name: "Example template", description: "Synthetic notebook template.", notebookContent: EXAMPLE_NOTEBOOK.notebookContent }] }],
  ["post /system-portal/notebook", { request: { name: "Example notebook", notebookContent: EXAMPLE_NOTEBOOK.notebookContent }, response: EXAMPLE_NOTEBOOK }],
  ["post /system-portal/notebook/templates/{templateId}", { parameters: [["templateId", "path", "example-template"]], request: { name: "Example notebook from template" }, response: { ...EXAMPLE_NOTEBOOK, name: "Example notebook from template" } }],
  ["put /system-portal/notebook", { request: { ...EXAMPLE_NOTEBOOK, name: "Updated example notebook" }, response: { ...EXAMPLE_NOTEBOOK, name: "Updated example notebook" } }],
  ["delete /system-portal/notebook/{id}", { parameters: [["id", "path", EXAMPLE_NOTEBOOK_ID]], response: EXAMPLE_NOTEBOOK }],
  ["get /system-portal/notebook/{id}/remote-diff-check", { parameters: [["id", "path", EXAMPLE_NOTEBOOK_ID], ["datasetId", "query", EXAMPLE_DATASET_ID]], response: { hasDifferences: false, reason: "Content is identical to remote" } }],
  ["post /system-portal/notebook/{id}/overwrite-from-remote", { parameters: [["id", "path", EXAMPLE_NOTEBOOK_ID]], request: { datasetId: EXAMPLE_DATASET_ID }, response: { message: `Successfully overwritten notebook ${EXAMPLE_NOTEBOOK_ID} from remote due to content mismatch`, overwritten: true, notebookId: EXAMPLE_NOTEBOOK_ID } }],
  ["post /system-portal/notebook/overwrite-all-from-remote", { response: { message: "Successfully overwritten all notebooks from remote", processedCount: 1, results: [{ notebookId: EXAMPLE_NOTEBOOK_ID, name: EXAMPLE_NOTEBOOK.name }] } }]
]);

export function listSourceFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const normalized = full.split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (!SKIP_PARTS.has(entry.name)) walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (SKIP_PATH_SNIPPETS.some((snippet) => normalized.includes(snippet))) continue;
      files.push(full);
    }
  }
  walk(root);
  return files.sort();
}

export function extractFromFile(filePath, appRepoRoot) {
  const source = fs.readFileSync(filePath, "utf8");
  const constants = extractConstants(source);
  let defaultClientBaseUrl = extractAxiosCreateBaseUrl(source, constants);
  if (!defaultClientBaseUrl && /from\s+["']\.\/request["']/.test(source)) {
    const siblingRequest = path.join(path.dirname(filePath), "request.ts");
    if (fs.existsSync(siblingRequest) && siblingRequest !== filePath) {
      defaultClientBaseUrl = extractAxiosCreateBaseUrl(fs.readFileSync(siblingRequest, "utf8"), constants);
    }
  }
  const relPath = path.relative(appRepoRoot, filePath).split(path.sep).join("/");
  const appName = getAppName(relPath);
  const operations = [
    ...extractRequestObjectCalls(source, relPath, appName, constants),
    ...extractMemberCalls(source, relPath, appName, constants, defaultClientBaseUrl),
    ...extractFetchCalls(source, relPath, appName, constants)
  ];

  return operations.map((operation) => ({
    ...operation,
    sourcePath: relPath,
    sourceLine: lineNumberAt(source, operation.index)
  }));
}

export function extractBackendOperations(functionsRoot, appRepoRoot) {
  const files = listSourceFiles(functionsRoot).filter((file) => !/\.(spec|test)\.[jt]sx?$/.test(file));
  const routeMap = readTrexRouteMap(functionsRoot);
  const classMounts = collectClassMounts(files);
  const functionMounts = collectFunctionMounts(files, functionsRoot, routeMap);
  const fastifyPluginMounts = collectFastifyPluginMounts(files);
  const swaggerOperations = extractSwaggerOperations(functionsRoot, appRepoRoot, routeMap);
  const operations = [...swaggerOperations];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const constants = extractConstants(source);
    const relPath = path.relative(appRepoRoot, file).split(path.sep).join("/");
    const functionName = getFunctionNameFromPath(file, functionsRoot);
    mergeEnvConstants(constants, source, routeMap.functionEnvConfigs.get(functionName));
    const defaultPrefixes = [
      ...(functionMounts.get(functionName) || []),
      ...(routeMap.functionSources.get(functionName) || [])
    ];
    const classNames = extractClassNames(source);
    const mountedPrefixes = classNames.flatMap((className) => classMounts.get(className) || []);
    const pluginPrefixes = fastifyPluginMounts.get(file) || [];
    const composedPluginPrefixes = pluginPrefixes.flatMap((pluginPrefix) =>
      defaultPrefixes.length
        ? defaultPrefixes.map((basePrefix) => normalizeBackendRoutePath(joinUrl(basePrefix, pluginPrefix)))
        : [pluginPrefix]
    );
    const routePrefixes = [...new Set([...mountedPrefixes, ...composedPluginPrefixes, ...defaultPrefixes, ""])];

    for (const operation of extractDanetControllerRoutes(source, relPath, constants)) {
      const fullPath = resolveBackendPath(operation.url, routePrefixes);
      if (!fullPath) continue;
      operations.push({
        ...operation,
        url: fullPath,
        baseURL: "",
        sourceKind: "backend",
        sourcePath: relPath,
        sourceLine: lineNumberAt(source, operation.index),
        appName: "backend",
        backendFunction: functionName,
        backendEnv: routeMap.functionEnvs.get(functionName) || functionName,
        handlerFound: true,
        handlerSources: [`${relPath}:${lineNumberAt(source, operation.index)}`]
      });
    }

    for (const operation of extractBackendRouteCalls(source, relPath, constants)) {
      const fullPath = resolveBackendPath(operation.url, routePrefixes);
      if (!fullPath) continue;
      operations.push({
        ...operation,
        url: fullPath,
        baseURL: "",
        sourceKind: "backend",
        sourcePath: relPath,
        sourceLine: lineNumberAt(source, operation.index),
        appName: "backend",
        backendFunction: functionName,
        backendEnv: routeMap.functionEnvs.get(functionName) || functionName,
        handlerFound: operation.handlerFound,
        handlerSources: operation.handlerFound ? [`${relPath}:${lineNumberAt(source, operation.index)}`] : []
      });
    }
  }

  return dedupeBackendOperations(operations);
}

export function buildServiceSpecs(operations, options = {}) {
  const byService = new Map();
  for (const operation of operations) {
    if ((!operation.url && !operation.baseURL) || !operation.method) continue;
    const normalized = normalizeEndpoint(operation);
    if (!normalized) continue;

    const service = normalized.serviceName;
    if (!byService.has(service)) {
      byService.set(service, {
        openapi: "3.1.0",
        info: {
          title: `Data2Evidence ${titleFromSlug(service)} API`,
          version: "0.1.0",
          description: "Source-derived from Data2Evidence UI API calls. Review against backend contracts before treating as authoritative."
        },
        servers: [{ url: normalized.serverUrl || "/" }],
        paths: {},
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT"
            }
          },
          schemas: {
            UnknownJson: {
              description: "Shape not inferred from UI source.",
              type: "object",
              additionalProperties: true
            }
          }
        },
        security: [{ bearerAuth: [] }]
      });
    }

    const spec = byService.get(service);
    addOperation(spec, normalized, operation);
  }

  for (const spec of byService.values()) {
    spec.paths = sortObject(spec.paths);
    for (const pathItem of Object.values(spec.paths)) {
      for (const method of Object.keys(pathItem)) {
        pathItem[method].parameters = sortParameters(pathItem[method].parameters || []);
      }
    }
  }

  return new Map([...byService.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function buildCombinedSpec(uiOperations, backendOperations, options = {}) {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Data2Evidence API",
      version: "0.1.0",
      description:
        "Combined OpenAPI spec derived from Data2Evidence UI API calls and backend route declarations. Schema shapes are conservative unless directly inferred."
    },
    servers: [{ url: "/" }],
    tags: [],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        UnknownJson: {
          description: "Shape not inferred from UI or backend source.",
          type: "object",
          additionalProperties: true
        }
      }
    },
    security: [{ bearerAuth: [] }],
  };

  for (const operation of uiOperations) {
    const normalized = normalizeEndpoint({ ...operation, sourceKind: "ui" });
    if (!normalized) continue;
    addCombinedOperation(spec, normalized, operation, "ui");
  }

  for (const operation of backendOperations) {
    const normalized = normalizeEndpoint(operation);
    if (!normalized) continue;
    addCombinedOperation(spec, normalized, operation, "backend");
  }

  for (const pathItem of Object.values(spec.paths)) {
    for (const method of Object.keys(pathItem)) {
      const operation = pathItem[method];
      operation["x-d2e-ui-sources"] = [...new Set(operation["x-d2e-ui-sources"] || [])].sort();
      operation["x-d2e-backend-sources"] = [...new Set(operation["x-d2e-backend-sources"] || [])].sort();
      if (operation["x-d2e-ui-sources"].length === 0) {
        delete operation["x-d2e-ui-sources"];
      }
      if (operation["x-d2e-backend-sources"].length === 0) {
        delete operation["x-d2e-backend-sources"];
      }
      operation["x-d2e-handler-sources"] = [...new Set(operation["x-d2e-handler-sources"] || [])].sort();
      if (operation["x-d2e-handler-sources"].length === 0) {
        delete operation["x-d2e-handler-sources"];
      }
      applyBackendKnowledge(operation, method, findOperationPath(spec.paths, pathItem));
      applyOperationExamples(operation, method, findOperationPath(spec.paths, pathItem));
      applyFallbackExamples(operation, method, findOperationPath(spec.paths, pathItem));
      operation.tags = buildOperationTags(operation);
      removeParameterDescriptions(operation);
      operation.parameters = sortParameters(operation.parameters || []);
      delete operation._serviceTag;
      delete operation._apps;
      delete operation._backendFunctions;
    }
  }

  spec.paths = sortObject(spec.paths);
  const tagNames = new Set([
    "ui-used",
    "backend-only",
    "backend-implemented",
    "backend-missing",
    "handler-found",
    "handler-unresolved"
  ]);
  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of Object.values(pathItem)) {
      for (const tag of operation.tags) tagNames.add(tag);
    }
  }
  spec.tags = tagObjects(tagNames);
  return stripD2eExtensions(spec);
}

export function splitSpecByService(spec) {
  const byService = new Map();
  for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const serviceName = serviceNameFromOperation(pathKey, operation);
      if (!byService.has(serviceName)) {
        byService.set(serviceName, {
          openapi: spec.openapi,
          info: {
            title: `Data2Evidence ${titleFromSlug(serviceName)} API`,
            version: spec.info.version,
            description:
              "Source-derived OpenAPI spec for one Data2Evidence service/function. Tags describe UI usage, backend coverage, and handler trace state."
          },
          servers: spec.servers,
          tags: [],
          paths: {},
          components: spec.components,
          security: spec.security
        });
      }
      const serviceSpec = byService.get(serviceName);
      if (!serviceSpec.paths[pathKey]) serviceSpec.paths[pathKey] = {};
      serviceSpec.paths[pathKey][method] = operation;
    }
  }

  for (const serviceSpec of byService.values()) {
    const tagNames = new Set();
    for (const pathItem of Object.values(serviceSpec.paths)) {
      for (const operation of Object.values(pathItem)) {
        for (const tag of operation.tags || []) tagNames.add(tag);
      }
    }
    serviceSpec.tags = tagObjects(tagNames);
    serviceSpec.paths = sortObject(serviceSpec.paths);
  }

  return new Map([...byService.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function extractConstants(source) {
  const constants = new Map();
  const constantRegex =
    /(?:const|let|var|private\s+static\s+readonly|static\s+readonly|private\s+readonly|readonly)\s+([A-Za-z_$][\w$]*)\s*=\s*([`'"])([\s\S]*?)\2/g;
  for (const match of source.matchAll(constantRegex)) {
    constants.set(match[1], match[3]);
  }
  return constants;
}

function mergeEnvConstants(constants, source, envConfig = {}) {
  const aliases = new Map();
  for (const [key, rawValue] of Object.entries(envConfig || {})) {
    const value = extractEnvDefaultValue(rawValue);
    if (!value) continue;
    aliases.set(key, value);
    aliases.set(key.replace(/__/g, "_"), value);
  }

  for (const [key, value] of aliases) {
    constants.set(`env.${key}`, value);
  }

  const assignmentRegex = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*env\.([A-Z0-9_]+)/g;
  for (const match of source.matchAll(assignmentRegex)) {
    const value = aliases.get(match[2]);
    if (value) constants.set(match[1], value);
  }
}

function extractEnvDefaultValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return "";
  const value = String(rawValue);
  if (!value.includes("${")) return value;
  const defaultMatch = /^\$\{[^}:]+:-(.*)\}$/.exec(value);
  if (!defaultMatch) return "";
  const defaultValue = defaultMatch[1];
  return defaultValue.includes("${") ? "" : defaultValue;
}

function extractAxiosCreateBaseUrl(source, constants) {
  const match = /axios\.create\s*\(\s*\{[\s\S]*?\bbaseURL\s*:\s*([^,\n}]+)/m.exec(source);
  if (!match) return "";
  return evaluateExpression(match[1], constants);
}

function extractRequestObjectCalls(source, relPath, appName, constants) {
  const operations = [];
  const callRegex = /\b(?:request|client)(?:<[^()]*>)?\s*\(/g;
  for (const match of source.matchAll(callRegex)) {
    const openParen = source.indexOf("(", match.index);
    const firstNonSpace = skipWhitespace(source, openParen + 1);
    if (source[firstNonSpace] !== "{") continue;
    const objectText = readBalanced(source, firstNonSpace, "{", "}");
    if (!objectText) continue;
    const props = parseObjectProperties(objectText.text);
    const method = normalizeMethod(evaluateExpression(props.get("method") || "", constants) || "GET");
    const url = evaluateExpression(props.get("url") || "``", constants);
    const baseURL = evaluateExpression(props.get("baseURL") || "", constants);
    operations.push({
      index: match.index,
      appName,
      operationName: findOperationName(source, match.index),
      method,
      baseURL,
      url,
      paramsExpression: props.get("params") || "",
      dataExpression: props.get("data") || "",
      headersExpression: props.get("headers") || "",
      responseType: evaluateExpression(props.get("responseType") || "", constants)
    });
  }
  return operations;
}

function extractMemberCalls(source, relPath, appName, constants, defaultClientBaseUrl) {
  const operations = [];
  const memberRegex = /\b(?:request|axios)\s*\.\s*(get|post|put|delete|patch)(?:<[^()]*>)?\s*\(/gi;
  for (const match of source.matchAll(memberRegex)) {
    const method = normalizeMethod(match[1]);
    const openParen = source.indexOf("(", match.index);
    const args = readCallArguments(source, openParen);
    if (!args) continue;
    const firstArg = args[0] || "";
    const secondArg = args[1] || "";
    const secondProps = secondArg.trim().startsWith("{") ? parseObjectProperties(secondArg) : new Map();
    operations.push({
      index: match.index,
      appName,
      operationName: findOperationName(source, match.index),
      method,
      baseURL: evaluateExpression(secondProps.get("baseURL") || defaultClientBaseUrl || "", constants),
      url: evaluateExpression(firstArg, constants),
      paramsExpression: secondProps.get("params") || "",
      dataExpression: method === "get" || method === "delete" ? "" : secondArg,
      headersExpression: secondProps.get("headers") || "",
      responseType: evaluateExpression(secondProps.get("responseType") || "", constants)
    });
  }
  return operations;
}

function extractFetchCalls(source, relPath, appName, constants) {
  const operations = [];
  const fetchRegex = /\bfetch\s*\(/g;
  for (const match of source.matchAll(fetchRegex)) {
    const openParen = source.indexOf("(", match.index);
    const args = readCallArguments(source, openParen);
    if (!args) continue;
    const options = args[1]?.trim().startsWith("{") ? parseObjectProperties(args[1]) : new Map();
    operations.push({
      index: match.index,
      appName,
      operationName: findOperationName(source, match.index),
      method: normalizeMethod(evaluateExpression(options.get("method") || "`GET`", constants)),
      baseURL: "",
      url: evaluateExpression(args[0] || "", constants),
      paramsExpression: "",
      dataExpression: options.get("body") || "",
      headersExpression: options.get("headers") || "",
      responseType: ""
    });
  }
  return operations;
}

function normalizeEndpoint(operation) {
  const rawBaseUrl = cleanUrl(operation.baseURL);
  let combined = cleanUrl(joinUrl(rawBaseUrl, operation.url || ""));
  if (!combined) return null;

  if (/^https?:\/\//i.test(combined)) {
    const url = new URL(combined.replace(/\{([^}]+)\}/g, "placeholder"));
    combined = `${url.origin}${url.pathname}`;
  }

  const [withoutQuery, queryString] = combined.split("?", 2);
  const knownPrefix = findKnownPrefix(withoutQuery, rawBaseUrl);
  if (!knownPrefix && /^[A-Za-z_$][\w$]*$/.test(withoutQuery)) return null;
  const serviceBase = knownPrefix || firstPathSegment(withoutQuery);
  if (!serviceBase) return null;

  let pathPart = stripLeadingSlash(withoutQuery);
  if (serviceBase && pathPart.startsWith(stripLeadingSlash(serviceBase))) {
    pathPart = pathPart.slice(stripLeadingSlash(serviceBase).length);
  } else if (serviceBase === "public-webapi-proxy" && pathPart.startsWith("{PUBLIC_WEBAPI_PROXY_URL}")) {
    pathPart = pathPart.slice("{PUBLIC_WEBAPI_PROXY_URL}".length);
  }
  const openApiPath = normalizeOpenApiPath(`/${stripLeadingSlash(pathPart) || ""}`);
  const serviceName = slugify(serviceBase);
  const queryParams = [
    ...extractQueryParams(queryString),
    ...extractParamsObjectKeys(operation.paramsExpression)
  ];

  return {
    ...operation,
    serviceName,
    serverUrl: `/${stripLeadingSlash(serviceBase)}`,
    rawBaseUrl,
    path: openApiPath,
    queryParams: [...new Set(queryParams)].sort(),
    pathParams: extractPathParams(openApiPath)
  };
}

function addOperation(spec, normalized, original) {
  const method = normalized.method;
  if (!spec.paths[normalized.path]) spec.paths[normalized.path] = {};

  const existing = spec.paths[normalized.path][method];
  if (existing) {
    for (const param of [...normalized.pathParams, ...normalized.queryParams]) {
      upsertParameter(existing.parameters, paramToOpenApi(param, normalized.pathParams.includes(param)));
    }
    return;
  }

  const operation = {
    operationId: uniqueOperationId(method, normalized.path, normalized.operationName),
    summary: summaryFromName(normalized.operationName, method, normalized.path),
    tags: [normalized.appName],
    parameters: [
      ...normalized.pathParams.map((param) => paramToOpenApi(param, true)),
      ...normalized.queryParams.map((param) => paramToOpenApi(param, false))
    ],
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UnknownJson" }
          }
        }
      },
      default: {
        description: "Error response"
      }
    }
  };

  if (normalized.dataExpression) {
    const contentType = /FormData|multipart\/form-data/i.test(`${normalized.dataExpression} ${normalized.headersExpression}`)
      ? "multipart/form-data"
      : "application/json";
    operation.requestBody = {
      required: true,
      content: {
        [contentType]: {
          schema: { $ref: "#/components/schemas/UnknownJson" }
        }
      }
    };
  }

  if (normalized.responseType === "blob") {
    operation.responses["200"].content = {
      "application/octet-stream": {
        schema: { type: "string", format: "binary" }
      }
    };
  }

  spec.paths[normalized.path][method] = operation;
}

function addCombinedOperation(spec, normalized, original, sourceKind) {
  const method = normalized.method;
  const fullPath = normalizeOpenApiPath(joinUrl(normalized.serverUrl, normalized.path));
  const pathKey = findEquivalentPath(spec.paths, fullPath, method) || fullPath;
  if (!spec.paths[pathKey]) spec.paths[pathKey] = {};

  const existing = spec.paths[pathKey][method];
  const sourceRef = `${original.sourcePath}:${original.sourceLine}`;
  if (existing) {
    mergeCombinedMetadata(existing, normalized, original, sourceKind, sourceRef);
    for (const param of [...extractPathParams(pathKey), ...normalized.queryParams]) {
      upsertParameter(existing.parameters, paramToOpenApi(param, extractPathParams(pathKey).includes(param)));
    }
    for (const param of normalized.openapiParameters || []) {
      if (param.in !== "body") upsertParameter(existing.parameters, param);
    }
    if (!existing.requestBody && normalized.dataExpression) {
      existing.requestBody = requestBodyFromExpression(normalized);
    }
    if (!existing.requestBody && (normalized.openapiParameters || []).some((param) => param.in === "body")) {
      existing.requestBody = requestBodyFromOpenApiParameters(normalized.openapiParameters);
    }
    return;
  }

  const pathParams = extractPathParams(pathKey);
  const operation = {
    operationId: uniqueOperationId(method, pathKey, normalized.operationName),
    summary: normalized.description || summaryFromName(normalized.operationName, method, pathKey),
    tags: [],
    parameters: [
      ...pathParams.map((param) => paramToOpenApi(param, true)),
      ...normalized.queryParams.map((param) => paramToOpenApi(param, false)),
      ...(normalized.openapiParameters || []).filter((param) => param.in !== "body")
    ],
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UnknownJson" }
          }
        }
      },
      default: {
        description: "Error response"
      }
    },
    "x-d2e-service": normalized.serviceName,
    "x-d2e-ui-sources": [],
    "x-d2e-backend-sources": [],
    "x-d2e-handler-sources": [],
    "x-d2e-handler-found": false,
    _serviceTag: `service:${normalized.serviceName}`,
    _apps: new Set(),
    _backendFunctions: new Set()
  };

  if (normalized.dataExpression) {
    operation.requestBody = requestBodyFromExpression(normalized);
  }
  if ((normalized.openapiParameters || []).some((param) => param.in === "body")) {
    operation.requestBody = requestBodyFromOpenApiParameters(normalized.openapiParameters);
  }

  if (normalized.responseType === "blob") {
    operation.responses["200"].content = {
      "application/octet-stream": {
        schema: { type: "string", format: "binary" }
      }
    };
  }

  mergeCombinedMetadata(operation, normalized, original, sourceKind, sourceRef);
  spec.paths[pathKey][method] = operation;
}

function mergeCombinedMetadata(operation, normalized, original, sourceKind, sourceRef) {
  operation._serviceTag = operation._serviceTag || `service:${normalized.serviceName}`;
  operation._apps = operation._apps || new Set();
  operation._backendFunctions = operation._backendFunctions || new Set();

  if (sourceKind === "ui") {
    operation["x-d2e-ui-sources"].push(sourceRef);
    if (original.appName) operation._apps.add(`ui:${original.appName}`);
  } else {
    for (const backendSource of original.backendSources || [sourceRef]) {
      operation["x-d2e-backend-sources"].push(backendSource);
    }
    operation["x-d2e-backend-implemented"] = true;
    if (original.backendFunction) {
      operation._backendFunctions.add(`backend:${original.backendFunction}`);
    }
    if (original.backendEnv) {
      operation["x-d2e-backend-env"] = original.backendEnv;
    }
    if (original.handlerFound) {
      operation["x-d2e-handler-found"] = true;
      for (const handlerSource of original.handlerSources || [sourceRef]) {
        operation["x-d2e-handler-sources"].push(handlerSource);
      }
    }
  }
}

function buildOperationTags(operation) {
  const tags = new Set();
  tags.add(operation._serviceTag);
  const hasUiSources = (operation["x-d2e-ui-sources"] || []).length > 0;
  const hasBackendSources = (operation["x-d2e-backend-sources"] || []).length > 0;
  if (hasUiSources) {
    tags.add("ui-used");
    for (const appTag of operation._apps || []) tags.add(appTag);
  } else {
    tags.add("backend-only");
  }
  if (hasBackendSources) {
    tags.add("backend-implemented");
    tags.add(operation["x-d2e-handler-found"] ? "handler-found" : "handler-unresolved");
    for (const functionTag of operation._backendFunctions || []) tags.add(functionTag);
  }
  if (!hasBackendSources && hasUiSources) {
    tags.add("handler-unresolved");
  }
  if (operation["x-d2e-backend-missing"]) {
    tags.add("backend-missing");
    tags.add("handler-unresolved");
  }
  return [...tags].sort();
}

function requestBodyFromExpression(normalized) {
  const contentType = /FormData|multipart\/form-data/i.test(`${normalized.dataExpression} ${normalized.headersExpression}`)
    ? "multipart/form-data"
    : "application/json";
  return {
    required: true,
    content: {
      [contentType]: {
        schema: { $ref: "#/components/schemas/UnknownJson" }
      }
    }
  };
}

function requestBodyFromOpenApiParameters(parameters) {
  const bodyParameter = parameters.find((param) => param.in === "body");
  return {
    required: bodyParameter?.required ?? true,
    content: {
      "application/json": {
        schema: bodyParameter?.schema || { $ref: "#/components/schemas/UnknownJson" }
      }
    }
  };
}

function applyBackendKnowledge(operation, method, pathKey) {
  if (!pathKey) return;
  const descriptions = [];
  const sourceTags = new Set(operation["x-d2e-description-sources"] || []);

  const generatedDescription = descriptionForPath(pathKey);
  if (generatedDescription) {
    descriptions.push(generatedDescription);
    sourceTags.add("knowledge");
  }

  const placeholderNote = placeholderNoteFor(method, pathKey);
  if (placeholderNote) {
    descriptions.push(placeholderNote);
    sourceTags.add("backend-trace");
    operation["x-d2e-backend-placeholder"] = true;
  }

  if (pathKey.startsWith("/d2e-webapi/cohortdefinition/") && pathKey.includes("/report/")) {
    sourceTags.add("backend-trace");
    operation["x-d2e-backend-missing"] = true;
    operation["x-d2e-handler-found"] = false;
  }

  if (descriptions.length > 0) {
    const existingDescription = operation.description || "";
    operation.description = mergeDescription(existingDescription, descriptions);
  }

  if (sourceTags.size > 0) {
    operation["x-d2e-description-sources"] = [...sourceTags].sort();
  }

  if (isD2eWebapiDatasetScoped(pathKey)) {
    upsertParameter(operation.parameters, {
      name: "datasetid",
      in: "header",
      required: true,
      schema: { type: "string" }
    });
  }
}

function applyOperationExamples(operation, method, pathKey) {
  const key = `${method} ${pathKey}`;
  const examples = TERMINOLOGY_EXAMPLES.get(key) || D2E_WEBAPI_EXAMPLES.get(key) || SYSTEM_PORTAL_EXAMPLES.get(key);
  if (!examples) return;

  if (examples.dropParameters?.length) {
    operation.parameters = (operation.parameters || []).filter((parameter) => !examples.dropParameters.includes(parameter.name));
  }

  for (const [name, location, example] of examples.parameters || []) {
    upsertParameter(operation.parameters, {
      name,
      in: location,
      required: location === "path",
      schema: schemaFromExample(example)
    });
    const parameter = operation.parameters.find((existing) => existing.name === name && existing.in === location);
    parameter.example = example;
    parameter.schema = schemaFromExample(example);
  }

  if (examples.request !== undefined) {
    operation.requestBody = operation.requestBody || requestBodyFromExpression({ dataExpression: "{}", headersExpression: "" });
    operation.requestBody.content = operation.requestBody.content || {};
    operation.requestBody.content["application/json"] = operation.requestBody.content["application/json"] || {
      schema: { $ref: "#/components/schemas/UnknownJson" }
    };
    operation.requestBody.content["application/json"].example = examples.request;
  }

  if (examples.responseStatus === 204) {
    operation.responses = operation.responses || {};
    delete operation.responses["200"];
    operation.responses["204"] = { description: "No content" };
  } else if (examples.response !== undefined) {
    operation.responses = operation.responses || {};
    const status = String(examples.responseStatus || 200);
    operation.responses[status] = operation.responses[status] || { description: "Successful response" };
    operation.responses[status].content = operation.responses[status].content || {};
    operation.responses[status].content["application/json"] = operation.responses[status].content["application/json"] || {
      schema: { $ref: "#/components/schemas/UnknownJson" }
    };
    operation.responses[status].content["application/json"].example = examples.response;
  }
}

function applyFallbackExamples(operation, method, pathKey) {
  if (!pathKey) return;

  for (const parameter of operation.parameters || []) {
    if (parameter.example !== undefined) continue;
    const example = exampleForParameter(parameter.name, parameter.in, pathKey);
    parameter.example = example;
    parameter.schema = schemaFromExample(example);
  }

  if (operation.requestBody && !requestBodyHasExample(operation.requestBody)) {
    const requestExample = fallbackRequestExample(method, pathKey, operation);
    const contentType = Object.keys(operation.requestBody.content || {})[0] || "application/json";
    operation.requestBody.content = operation.requestBody.content || {};
    operation.requestBody.content[contentType] = operation.requestBody.content[contentType] || {
      schema: { $ref: "#/components/schemas/UnknownJson" }
    };
    operation.requestBody.content[contentType].example = requestExample;
  }

  if (knownNoContentResponse(method, pathKey)) {
    operation.responses = { [knownNoContentResponse(method, pathKey)]: { description: "No content" }, default: { description: "Error response" } };
    return;
  }

  if (!responseHasExample(operation.responses) && !hasNoContentResponse(operation.responses)) {
    const responseExample = fallbackResponseExample(method, pathKey, operation);
    const status = method === "post" && !/\/(query|search|lookup|test|chat|log)\b/i.test(pathKey) ? "201" : "200";
    operation.responses = operation.responses || {};
    operation.responses[status] = operation.responses[status] || { description: status === "201" ? "Created" : "Successful response" };
    operation.responses[status].content = operation.responses[status].content || {};
    operation.responses[status].content["application/json"] = operation.responses[status].content["application/json"] || {
      schema: { $ref: "#/components/schemas/UnknownJson" }
    };
    operation.responses[status].content["application/json"].example = responseExample;
  }
}

function requestBodyHasExample(requestBody) {
  return Object.values(requestBody?.content || {}).some((mediaType) => mediaType.example !== undefined || mediaType.examples);
}

function responseHasExample(responses = {}) {
  return Object.values(responses || {}).some((response) =>
    Object.values(response?.content || {}).some((mediaType) => mediaType.example !== undefined || mediaType.examples)
  );
}

function hasNoContentResponse(responses = {}) {
  return Object.prototype.hasOwnProperty.call(responses || {}, "204");
}

function exampleForParameter(name, location, pathKey) {
  const lower = String(name || "").toLowerCase();
  if (location === "path" || lower.endsWith("id") || lower.includes("userid")) {
    if (lower.includes("dataset") || lower === "sourcekey") return EXAMPLE_DATASET_ID;
    if (lower.includes("tenant")) return EXAMPLE_TENANT_ID;
    if (lower.includes("study")) return EXAMPLE_STUDY_ID;
    if (lower.includes("flowrun")) return EXAMPLE_FLOW_RUN_ID;
    if (lower.includes("flow")) return EXAMPLE_FLOW_ID;
    if (lower.includes("release")) return EXAMPLE_RELEASE_ID;
    if (lower.includes("resource")) return EXAMPLE_RESOURCE_ID;
    if (lower.includes("conversion")) return "example-conversion";
    if (lower.includes("cohortdefinition")) return EXAMPLE_COHORT_ID;
    if (lower.includes("conceptset")) return 12;
    if (lower.includes("concept")) return EXAMPLE_CONCEPT_ID;
    if (lower.includes("user")) return EXAMPLE_USER_ID;
    if (lower === "id") {
      if (pathKey.includes("concept-set") || pathKey.includes("conceptset")) return 12;
      if (pathKey.includes("cohort")) return EXAMPLE_COHORT_ID;
      if (pathKey.includes("notebook")) return EXAMPLE_NOTEBOOK_ID;
      if (pathKey.includes("flow")) return EXAMPLE_FLOW_ID;
      return "example-id";
    }
  }
  if (lower.includes("locale")) return "en";
  if (lower.includes("dialect")) return "postgres";
  if (lower.includes("databasecode")) return EXAMPLE_DATABASE_CODE;
  if (lower.includes("schema")) return EXAMPLE_SCHEMA_NAME;
  if (lower.includes("tablename")) return "person";
  if (lower.includes("filename")) return EXAMPLE_RESOURCE.name;
  if (lower.includes("name")) return "example";
  if (lower.includes("type")) return "example-type";
  if (lower.includes("action")) return "getBackendConfig";
  if (lower.includes("role")) return "RESEARCHER";
  if (lower.includes("query") || lower.includes("search") || lower.includes("filter")) return "example";
  if (lower.includes("page") || lower.includes("offset")) return 0;
  if (lower.includes("limit") || lower.includes("count") || lower.includes("rows")) return 25;
  if (lower.includes("overwrite") || lower.includes("refresh")) return false;
  return "example";
}

function fallbackRequestExample(method, pathKey, operation) {
  const service = firstPathSegment(pathKey);
  if (isMultipartOperation(operation)) {
    return { file: "example.csv", username: EXAMPLE_USER_ID, dataKey: "example-data-key" };
  }
  if (pathKey.startsWith("/code-suggestion/chat")) return { context: "Synthetic table metadata.", userInput: "Suggest a simple query." };
  if (pathKey.startsWith("/code-suggestion")) return { code: "SELECT * FROM example_table" };
  if (pathKey.startsWith("/mcp/chat")) return { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  if (pathKey.startsWith("/demo")) return { encryptionKeys: "example-encryption-key" };
  if (pathKey.startsWith("/parquet-export")) {
    return {
      datasetId: EXAMPLE_DATASET_ID,
      cohortId: EXAMPLE_COHORT_ID,
      templateId: "example-template",
      name: "example-query",
      format: "json",
      conceptIds: [EXAMPLE_CONCEPT_ID],
      yearRange: { from: "2020", to: "2024" }
    };
  }
  if (pathKey.startsWith("/data-mapping")) {
    return {
      source_tables: [{ table_name: "source_person", column_list: [{ column_name: "person_id", column_type: "integer" }] }],
      etl_mapping: {}
    };
  }
  if (pathKey.startsWith("/concept-mapping")) {
    return { sourceVocabularyId: "EXAMPLE", conceptMappings: "eJyrVkrLz1eyUkpKLFKqBQA8LQYQ" };
  }
  if (pathKey.startsWith("/strategus/analysis/code")) return { studyId: EXAMPLE_STUDY_ID, viewerCode: "print('example')" };
  if (pathKey.startsWith("/strategus/analysis")) {
    return { studyId: EXAMPLE_STUDY_ID, tokenStudyCode: "EXAMPLE_STUDY", tenantId: EXAMPLE_TENANT_ID, mode: "notebook", analysisSpec: { name: "Example analysis" } };
  }
  if (pathKey.startsWith("/strategus-results")) return { studyId: EXAMPLE_STUDY_ID, datasetId: EXAMPLE_DATASET_ID, viewerCode: "print('example')" };
  if (pathKey.startsWith("/white-rabbit/api/test-connection")) return { databaseCode: EXAMPLE_DATABASE_CODE, schema: EXAMPLE_SCHEMA_NAME };
  if (pathKey.startsWith("/white-rabbit/api/conversion")) return { flow_run_id: EXAMPLE_FLOW_RUN_ID, file_id: EXAMPLE_RESOURCE_ID, file_name: "scan-report.json" };
  if (pathKey.includes("/query")) return { datasetId: EXAMPLE_DATASET_ID, query: { type: "example" }, options: {} };
  if (pathKey.includes("/chat")) return { messages: [{ role: "user", content: "Summarize this synthetic dataset note." }] };
  if (pathKey.includes("/test-connection") || pathKey.endsWith("/test")) {
    return { dialect: "postgres", host: "db.example.local", port: 5432, database: "example_database", schema: EXAMPLE_SCHEMA_NAME };
  }
  if (pathKey.includes("/mapping")) return { sourceColumns: ["example_source"], targetColumns: ["example_target"] };
  if (pathKey.includes("/concept-mapping")) return { mappings: [{ source: "EXAMPLE-001", target: EXAMPLE_CONCEPT }] };
  if (pathKey.includes("/cohort")) return { datasetId: EXAMPLE_DATASET_ID, cohortDefinition: EXAMPLE_COHORT_DEFINITION };
  if (pathKey.includes("/bookmark")) return { id: "example-bookmark", name: "Example bookmark", bookmark: { filters: [] } };
  if (pathKey.includes("/dataset")) return { ...EXAMPLE_PORTAL_DATASET, id: EXAMPLE_DATASET_ID };
  if (pathKey.includes("/user") || pathKey.includes("/member") || pathKey.includes("/tenant")) {
    return { userId: EXAMPLE_USER_ID, tenantId: EXAMPLE_TENANT_ID, role: "RESEARCHER" };
  }
  if (pathKey.includes("/feature")) return { features: [EXAMPLE_PORTAL_FEATURE] };
  if (pathKey.includes("/config")) return { action: "getBackendConfig", configId: "example-config", data: {} };
  if (pathKey.includes("/flow-run") || pathKey.includes("/analysis-run")) {
    return { options: { datasetId: EXAMPLE_DATASET_ID, flowId: EXAMPLE_FLOW_ID, mode: "example" } };
  }
  if (pathKey.includes("/flow") || pathKey.includes("/dataflow") || pathKey.includes("/analysisflow")) {
    return { id: EXAMPLE_FLOW_ID, name: "Example flow", revisionId: "example-revision", nodes: [], edges: [] };
  }
  if (pathKey.includes("/strategus")) {
    return { studyId: EXAMPLE_STUDY_ID, datasetId: EXAMPLE_DATASET_ID, analysisSpecification: { name: "Example analysis" } };
  }
  if (pathKey.includes("/white-rabbit")) {
    return { datasetId: EXAMPLE_DATASET_ID, schemaName: EXAMPLE_SCHEMA_NAME, tables: ["person"] };
  }
  if (service === "trex") return { id: "example", name: "Example plugin", version: "0.0.1" };
  if (method === "delete") return { id: "example-id" };
  return { id: "example-id", name: "Example request" };
}

function fallbackResponseExample(method, pathKey, operation) {
  if (operation.responses?.["200"]?.content?.["application/octet-stream"]) {
    return { fileName: "example.bin", contentType: "application/octet-stream" };
  }
  if (pathKey.endsWith("assets.json")) return { js: ["/assets/index.js"], css: ["/assets/index.css"] };
  if (pathKey.endsWith("config.json")) return { apiUrl: "/gateway/api", features: { exampleFeature: true } };
  if (pathKey.startsWith("/prefect/d2e/ui-settings")) return { api_url: "/prefect/d2e/api", csrf_enabled: false, flags: {} };
  if (pathKey.startsWith("/code-suggestion/chat")) return { stream: "event-stream", message: "Synthetic streamed suggestion." };
  if (pathKey.startsWith("/code-suggestion")) return { text: "SELECT * FROM example_table;" };
  if (pathKey.startsWith("/mcp/chat")) return { jsonrpc: "2.0", id: 1, result: { tools: [] } };
  if (pathKey.startsWith("/demo/progress")) return { status: "completed", steps: [{ step: "setup", code: "SETUP", message: "Completed", status: "completed" }] };
  if (pathKey.startsWith("/demo")) return { id: "example-progress", message: "Demo setup started" };
  if (pathKey.startsWith("/backend/api/get_cdm_versions")) return ["5.3.0", "5.4"];
  if (pathKey.startsWith("/backend/api/get_cdm_schema")) {
    return [{ table_name: "person", column_list: [{ column_name: "person_id", column_type: "integer", is_column_nullable: false }] }];
  }
  if (pathKey.startsWith("/backend/api/lookup/sql")) return { sql: "SELECT * FROM example_lookup" };
  if (pathKey.startsWith("/backend/api/lookups")) return [{ id: "example-lookup", name: "Example lookup" }];
  if (pathKey.startsWith("/fhir-gateway/deleteDataset")) return { deleted: true, id: exampleForPathId(pathKey) };
  if (pathKey.startsWith("/gateway/api/db/test") || pathKey.startsWith("/white-rabbit/api/test-connection")) {
    return { success: true, message: "Connection successful" };
  }
  if (pathKey.startsWith("/gateway/api/db/database-creds/list")) {
    return [{ id: "example-db", host: "db.example.local", port: 5432, name: EXAMPLE_DATABASE_CODE, dialect: "postgres" }];
  }
  if (pathKey.startsWith("/gateway/api/dataset/info")) return { type: "research", tokenStudyCode: "EXAMPLE_STUDY" };
  if (pathKey.startsWith("/gateway/api/dataset/dashboard/list")) return [{ id: 1, datasetId: EXAMPLE_DATASET_ID, name: "Example dashboard", language: "sql" }];
  if (pathKey.startsWith("/gateway/api/dataset") && method === "post") return { id: EXAMPLE_DATASET_ID, cacheId: "example-cache", flowRunId: EXAMPLE_FLOW_RUN_ID };
  if (pathKey.startsWith("/jobplugins") && pathKey.includes("/flow-run")) return { flowRunId: EXAMPLE_FLOW_RUN_ID };
  if (pathKey.startsWith("/jobplugins") && (pathKey.includes("/dataflow") || pathKey.includes("/analysisflow"))) {
    return { id: EXAMPLE_FLOW_ID, name: "Example flow", revisionId: "example-revision", nodes: [], edges: [] };
  }
  if (pathKey.startsWith("/jobplugins")) return fallbackEntityExample(pathKey);
  if (pathKey.startsWith("/strategus/template")) return [{ filename: "example-analysis.json", content: { name: "Example analysis" } }];
  if (pathKey.startsWith("/strategus/analysis") && method === "get" && !/\{[^}]+\}/.test(pathKey)) return [fallbackEntityExample(pathKey)];
  if (pathKey.startsWith("/strategus/analysis") && method !== "get") return { message: "Strategus analysis saved", analysisId: "example-analysis" };
  if (pathKey.startsWith("/strategus-results") && pathKey.includes("/status")) return { running: true, message: "Viewer is running" };
  if (pathKey.startsWith("/strategus-results") && method === "delete") return { stopped: true, message: "Viewer stopped" };
  if (pathKey.startsWith("/strategus-results")) return { message: "Strategus result viewer started" };
  if (pathKey.startsWith("/pa-config-svc/wizards/config")) return { wizards: [{ id: "example-wizard", name: "Example wizard" }] };
  if (pathKey.startsWith("/pa-config-svc")) return { configId: "example-config", config: {} };
  if (pathKey.startsWith("/parquet-export")) return [{ person_id: 1, value: "example" }];
  if (pathKey.startsWith("/data-mapping")) {
    return { data: [{ source_table: "source_person", target_table: "person", columns_mapping: { person_id: "person_id" } }] };
  }
  if (pathKey.startsWith("/concept-mapping")) return [{ source_code: "EXAMPLE-001", source_vocabulary_id: "EXAMPLE", target_concept_id: EXAMPLE_CONCEPT_ID }];
  if (pathKey.startsWith("/files-manager/api/{userDataId}") && method === "get") return { fileName: "example.csv", contentType: "text/csv" };
  if (pathKey.includes("/translations/") || pathKey.includes("/resources/")) return { example: "Example translation" };
  if (pathKey.includes("/health") || pathKey.includes("/check-liveness") || pathKey.includes("/check-readiness")) return { status: "ok" };
  if (pathKey.includes("/status") || pathKey.includes("/state") || pathKey.includes("/progress")) {
    return { id: exampleForPathId(pathKey), status: "COMPLETED", progress: 100 };
  }
  if (method === "delete") return { id: exampleForPathId(pathKey), deleted: true };
  if (pathKey.includes("/download")) return { fileName: EXAMPLE_RESOURCE.name, contentType: "text/csv", data: "ZXhhbXBsZQ==" };
  if (pathKey.includes("/list") || pathKey.endsWith("/roles") || pathKey.endsWith("/plugins") || isCollectionGet(method, pathKey)) {
    return [fallbackEntityExample(pathKey)];
  }
  if (pathKey.includes("/count")) return { count: 42 };
  if (pathKey.includes("/exists") || pathKey.includes("/exist")) return { exists: true };
  if (pathKey.includes("/query") && method === "post") return { sql: "SELECT 1", parameters: [] };
  if (pathKey.includes("/chat")) return { message: { role: "assistant", content: "Synthetic response for documentation." } };
  if (pathKey.includes("/test-connection") || pathKey.endsWith("/test")) return { status: "success", message: "Connection test succeeded" };
  if (pathKey.includes("/schema") || pathKey.includes("/metadata")) {
    return { schemas: [{ name: EXAMPLE_SCHEMA_NAME, tables: [{ name: "person", columns: ["person_id"] }] }] };
  }
  if (pathKey.includes("/upload")) return { id: EXAMPLE_RESOURCE_ID, fileName: EXAMPLE_RESOURCE.name, uploaded: true };
  if (method === "post") return { ...fallbackEntityExample(pathKey), created: true };
  if (method === "put" || method === "patch") return { ...fallbackEntityExample(pathKey), updated: true };
  return fallbackEntityExample(pathKey);
}

function knownNoContentResponse(method, pathKey) {
  if (method === "delete" && pathKey.startsWith("/fhir-gateway/deleteDataset")) return "204";
  return "";
}

function isMultipartOperation(operation) {
  return Object.keys(operation.requestBody?.content || {}).some((contentType) => contentType.includes("multipart/form-data"));
}

function isCollectionGet(method, pathKey) {
  if (method !== "get") return false;
  const tail = pathKey.split("/").filter(Boolean).pop() || "";
  return /s$/.test(tail) && !/\{[^}]+\}/.test(tail);
}

function exampleForPathId(pathKey) {
  if (pathKey.includes("dataset")) return EXAMPLE_DATASET_ID;
  if (pathKey.includes("flow-run")) return EXAMPLE_FLOW_RUN_ID;
  if (pathKey.includes("flow")) return EXAMPLE_FLOW_ID;
  if (pathKey.includes("study")) return EXAMPLE_STUDY_ID;
  if (pathKey.includes("resource")) return EXAMPLE_RESOURCE_ID;
  return "example-id";
}

function fallbackEntityExample(pathKey) {
  if (pathKey.includes("/dataset")) return EXAMPLE_PORTAL_DATASET;
  if (pathKey.includes("/cohort")) return { id: EXAMPLE_COHORT_ID, name: "Example cohort", datasetId: EXAMPLE_DATASET_ID };
  if (pathKey.includes("/bookmark")) return { id: "example-bookmark", name: "Example bookmark", bookmark: { filters: [] } };
  if (pathKey.includes("/concept-mapping")) return { id: "example-mapping", source: "EXAMPLE-001", target: EXAMPLE_CONCEPT };
  if (pathKey.includes("/data-mapping")) return { sourceColumn: "example_source", targetColumn: "example_target", confidence: 0.98 };
  if (pathKey.includes("/user") || pathKey.includes("/member")) return { id: EXAMPLE_USER_ID, username: EXAMPLE_USER_ID, roles: ["RESEARCHER"] };
  if (pathKey.includes("/tenant")) return EXAMPLE_TENANT;
  if (pathKey.includes("/feature")) return EXAMPLE_PORTAL_FEATURE;
  if (pathKey.includes("/config")) return { id: "example-config", type: "example", value: {} };
  if (pathKey.includes("/flow-run") || pathKey.includes("/analysis-run")) {
    return { id: EXAMPLE_FLOW_RUN_ID, flowId: EXAMPLE_FLOW_ID, status: "COMPLETED", createdAt: "2026-01-01T00:00:00.000Z" };
  }
  if (pathKey.includes("/flow") || pathKey.includes("/dataflow") || pathKey.includes("/analysisflow")) {
    return { id: EXAMPLE_FLOW_ID, name: "Example flow", revisionId: "example-revision" };
  }
  if (pathKey.includes("/strategus")) return { studyId: EXAMPLE_STUDY_ID, datasetId: EXAMPLE_DATASET_ID, status: "READY" };
  if (pathKey.includes("/white-rabbit")) return { id: "example-scan", status: "COMPLETED", tables: [{ name: "person", rows: 10 }] };
  if (pathKey.includes("/file") || pathKey.includes("/resource")) return EXAMPLE_RESOURCE;
  if (pathKey.includes("/db")) return { id: "example-db", dialect: "postgres", databaseCode: EXAMPLE_DATABASE_CODE };
  if (pathKey.includes("/plugin")) return { name: "example-plugin", version: "0.0.1", status: "installed" };
  if (pathKey.includes("/lookup")) return { name: "example-lookup", sql: "SELECT 1" };
  return { id: "example-id", name: "Example item" };
}

function removeParameterDescriptions(operation) {
  for (const parameter of operation.parameters || []) {
    delete parameter.description;
  }
}

function schemaFromExample(example) {
  if (Number.isInteger(example)) return { type: "integer" };
  if (typeof example === "number") return { type: "number" };
  if (typeof example === "boolean") return { type: "boolean" };
  if (Array.isArray(example)) return { type: "array", items: true };
  if (example && typeof example === "object") return { type: "object", additionalProperties: true };
  return { type: "string" };
}

function findOperationPath(paths, targetPathItem) {
  return Object.entries(paths).find(([, pathItem]) => pathItem === targetPathItem)?.[0] || "";
}

function descriptionForPath(pathKey) {
  return PATH_DESCRIPTION_RULES.find((rule) => rule.test(pathKey))?.description || "";
}

function placeholderNoteFor(method, pathKey) {
  return (
    PLACEHOLDER_BACKEND_RULES.find((rule) => rule.method === method && parameterShape(rule.path) === parameterShape(pathKey))
      ?.note || ""
  );
}

function mergeDescription(existingDescription, additions) {
  const parts = [existingDescription, ...additions]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join("\n\n");
}

function isD2eWebapiDatasetScoped(pathKey) {
  return [
    "/d2e-webapi/cohortdefinition",
    "/d2e-webapi/conceptset",
    "/d2e-webapi/vocabulary",
    "/d2e-webapi/cdmresults"
  ].some((prefix) => pathKey === prefix || pathKey.startsWith(`${prefix}/`));
}

function relativeSourceRef(appRepoRoot, sourceRef) {
  const index = sourceRef.lastIndexOf(":");
  const filePath = index > 1 ? sourceRef.slice(0, index) : sourceRef;
  const line = index > 1 ? sourceRef.slice(index + 1) : "";
  const relPath = path.relative(appRepoRoot, filePath).split(path.sep).join("/");
  return line ? `${relPath}:${line}` : relPath;
}

function readTrexRouteMap(functionsRoot) {
  const packagePath = path.join(functionsRoot, "package.json");
  const functionSources = new Map();
  const functionEnvs = new Map();
  const functionEnvConfigs = new Map();
  if (!fs.existsSync(packagePath)) return { functionSources, functionEnvs, functionEnvConfigs };

  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const envConfigs = pkg.trex?.functions?.env || {};
  for (const entry of pkg.trex?.functions?.api || []) {
    if (!entry.function || !entry.source) continue;
    const functionName = stripLeadingSlash(entry.function).split("/")[0];
    const source = normalizeBackendRoutePath(entry.source);
    if (!functionSources.has(functionName)) functionSources.set(functionName, []);
    functionSources.get(functionName).push(source);
    if (entry.env) {
      functionEnvs.set(functionName, entry.env);
      functionEnvConfigs.set(functionName, envConfigs[entry.env] || {});
    }
  }
  for (const [key, value] of functionSources) {
    functionSources.set(key, [...new Set(value)].sort((a, b) => b.length - a.length));
  }
  return { functionSources, functionEnvs, functionEnvConfigs };
}

function collectClassMounts(files) {
  const mounts = new Map();
  const useRegex =
    /\.(?:use)\s*\(\s*([`'"])([^`'"]+)\1\s*,\s*new\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\.\s*(?:router|getRouter\(\))/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(useRegex)) {
      const className = match[3];
      if (!mounts.has(className)) mounts.set(className, []);
      mounts.get(className).push(normalizeBackendRoutePath(match[2]));
    }
  }
  for (const [key, value] of mounts) {
    mounts.set(key, [...new Set(value)].sort((a, b) => b.length - a.length));
  }
  return mounts;
}

function collectFunctionMounts(files, functionsRoot, routeMap) {
  const mounts = new Map();
  const useRegex = /\b(?:app|this\.app)\s*\.\s*use\s*\(\s*([`'"])([^`'"]+)\1\s*,/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const functionName = getFunctionNameFromPath(file, functionsRoot);
    const constants = extractConstants(source);
    mergeEnvConstants(constants, source, routeMap.functionEnvConfigs.get(functionName));
    for (const match of source.matchAll(useRegex)) {
      const prefix = normalizeBackendRoutePath(evaluateExpression(`${match[1]}${match[2]}${match[1]}`, constants));
      if (prefix.includes("check-liveness") || prefix.includes("check-readiness")) continue;
      if (!mounts.has(functionName)) mounts.set(functionName, []);
      mounts.get(functionName).push(prefix);
    }
  }
  for (const [key, value] of mounts) {
    mounts.set(key, [...new Set(value)].sort((a, b) => b.length - a.length));
  }
  return mounts;
}

function collectFastifyPluginMounts(files) {
  const fileByImport = new Map();
  const mountsByFile = new Map();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const namedImportRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/g;
    for (const match of source.matchAll(namedImportRegex)) {
      for (const imported of match[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
        fileByImport.set(`${file}:${imported}`, resolveImportPath(file, match[2]));
      }
    }

    const defaultImportRegex = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g;
    for (const match of source.matchAll(defaultImportRegex)) {
      fileByImport.set(`${file}:${match[1]}`, resolveImportPath(file, match[2]));
    }
  }

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const constants = extractConstants(source);
    const registerRegex =
      /\bapp\.register\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{[\s\S]*?\bprefix\s*:\s*([^,\n}]+)[\s\S]*?\}\s*\)/g;
    for (const match of source.matchAll(registerRegex)) {
      const target = fileByImport.get(`${file}:${match[1]}`);
      if (!target) continue;
      const prefix = normalizeBackendRoutePath(evaluateExpression(match[2], constants));
      if (!mountsByFile.has(target)) mountsByFile.set(target, []);
      mountsByFile.get(target).push(prefix);
    }
  }

  for (const [key, value] of mountsByFile) {
    mountsByFile.set(key, [...new Set(value)].sort((a, b) => b.length - a.length));
  }
  return mountsByFile;
}

function extractSwaggerOperations(functionsRoot, appRepoRoot, routeMap) {
  const swaggerFiles = listSwaggerFiles(functionsRoot);
  const operations = [];
  for (const file of swaggerFiles) {
    const source = fs.readFileSync(file, "utf8");
    const parsed = parseSwaggerYaml(source);
    if (!parsed.basePath || parsed.operations.length === 0) continue;

    const functionName = getFunctionNameFromPath(file, functionsRoot);
    const relPath = path.relative(appRepoRoot, file).split(path.sep).join("/");
  for (const operation of parsed.operations) {
      const handler = resolveSwaggerHandler(functionsRoot, functionName, operation.controller, operation.operationId);
      operations.push({
        sourceKind: "backend",
        sourcePath: relPath,
        sourceLine: operation.sourceLine,
        appName: "backend",
        backendFunction: functionName,
        backendEnv: routeMap.functionEnvs.get(functionName) || functionName,
        operationName: operation.operationId || "backendRoute",
        method: operation.method,
        baseURL: "",
        url: normalizeBackendRoutePath(joinUrl(parsed.basePath, operation.path)),
        paramsExpression: "",
        dataExpression: operation.hasBody ? "{}" : "",
        headersExpression: "",
        responseType: "",
        description: operation.description,
        openapiParameters: operation.parameters,
        handlerFound: handler.found,
        handlerSources: handler.sources.map((sourceRef) => relativeSourceRef(appRepoRoot, sourceRef))
      });
    }
  }
  return operations;
}

function listSwaggerFiles(functionsRoot) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_PARTS.has(entry.name) && entry.name !== "mcp-server") walk(full);
        continue;
      }
      if (/swagger\.ya?ml$/i.test(entry.name) || /openapi.*\.ya?ml$/i.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(functionsRoot);
  return files.sort();
}

function resolveSwaggerHandler(functionsRoot, functionName, controllerName, operationId) {
  if (!controllerName || !operationId) return { found: false, sources: [] };

  const functionRoot = path.join(functionsRoot, functionName);
  const candidates = [
    path.join(functionRoot, "src/api/controllers", `${controllerName}.ts`),
    path.join(functionRoot, "src", controllerName, `${controllerName}.router.ts`),
    path.join(functionRoot, "src", controllerName, "routes.ts")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const source = fs.readFileSync(candidate, "utf8");
    const line = findExportedHandlerLine(source, operationId);
    if (line) return { found: true, sources: [`${candidate}:${line}`] };
  }

  return { found: false, sources: [] };
}

function findExportedHandlerLine(source, operationId) {
  const escaped = escapeRegExp(operationId);
  const patterns = [
    new RegExp(`export\\s+async\\s+function\\s+${escaped}\\b`),
    new RegExp(`export\\s+function\\s+${escaped}\\b`),
    new RegExp(`export\\s+const\\s+${escaped}\\b`)
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) return lineNumberAt(source, match.index);
  }
  return 0;
}

export function parseSwaggerYaml(source) {
  const lines = source.split("\n");
  let basePath = "";
  const operations = [];
  let inPaths = false;
  let currentPath = "";
  let currentMethod = "";
  let currentController = "";
  let currentOperation = null;
  let currentParameter = null;
  let inParameters = false;

  function finishParameter() {
    if (!currentOperation || !currentParameter) return;
    currentOperation.parameters.push({
      name: currentParameter.name || "body",
      in: currentParameter.in || "query",
      required: currentParameter.required === "true" || currentParameter.in === "path",
      description: currentParameter.description,
      schema: swaggerSchemaFromParameter(currentParameter)
    });
    if ((currentParameter.in || "").trim() === "body") currentOperation.hasBody = true;
    currentParameter = null;
  }

  function finishOperation() {
    finishParameter();
    if (currentOperation) operations.push(currentOperation);
    currentOperation = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!inPaths && trimmed.startsWith("basePath:")) {
      basePath = unquoteYamlValue(trimmed.slice("basePath:".length).trim());
      continue;
    }
    if (trimmed === "paths:") {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^[A-Za-z0-9_-]+:/.test(trimmed) && !line.startsWith(" ")) {
      finishOperation();
      currentPath = "";
      currentMethod = "";
      inPaths = false;
      continue;
    }

    const pathMatch = /^ {2}([/?][^:]+):\s*$/.exec(line);
    if (pathMatch) {
      finishOperation();
      currentPath = pathMatch[1];
      currentMethod = "";
      currentController = "";
      continue;
    }

    if (currentPath && /^ {4}x-swagger-router-controller:\s*/.test(line)) {
      currentController = unquoteYamlValue(trimmed.slice("x-swagger-router-controller:".length).trim());
      continue;
    }

    const methodMatch = /^ {4}(get|post|put|delete|patch|head|options):\s*$/i.exec(line);
    if (methodMatch && currentPath) {
      finishOperation();
      inParameters = false;
      currentMethod = methodMatch[1].toLowerCase();
      currentOperation = {
        path: expressPathToOpenApi(currentPath),
        method: currentMethod,
        sourceLine: index + 1,
        operationId: "",
        controller: currentController,
        description: "",
        parameters: [],
        hasBody: false
      };
      continue;
    }

    if (!currentOperation) continue;
    const methodSectionMatch = /^ {6}([A-Za-z_][\w-]*):/.exec(line);
    if (methodSectionMatch) {
      if (methodSectionMatch[1] === "parameters") {
        inParameters = true;
      } else if (inParameters) {
        finishParameter();
        inParameters = false;
      }
    }
    if (/^ {6}operationId:\s*/.test(line)) {
      currentOperation.operationId = unquoteYamlValue(trimmed.slice("operationId:".length).trim());
      continue;
    }
    if (/^ {6}description:\s*/.test(line)) {
      currentOperation.description = unquoteYamlValue(trimmed.slice("description:".length).trim());
      continue;
    }

    const parameterStart = inParameters ? /^ {8}-\s+name:\s*(.+)\s*$/.exec(line) : null;
    if (parameterStart) {
      finishParameter();
      currentParameter = { name: unquoteYamlValue(parameterStart[1].trim()) };
      continue;
    }

    const inlineParameterStart = inParameters ? /^ {8}-\s+in:\s*(.+)\s*$/.exec(line) : null;
    if (inlineParameterStart) {
      finishParameter();
      currentParameter = { in: unquoteYamlValue(inlineParameterStart[1].trim()) };
      continue;
    }

    if (inParameters && currentParameter) {
      const propMatch = /^ {10}([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (propMatch) {
        currentParameter[propMatch[1]] = unquoteYamlValue(propMatch[2].trim());
      }
      const schemaTypeMatch = /^ {12}type:\s*(.+)$/.exec(line);
      if (schemaTypeMatch) {
        currentParameter.type = unquoteYamlValue(schemaTypeMatch[1].trim());
      }
    }
  }

  finishOperation();
  return { basePath, operations };
}

function swaggerSchemaFromParameter(parameter) {
  if (parameter.schema) return { $ref: "#/components/schemas/UnknownJson" };
  return { type: swaggerTypeToOpenApi(parameter.type || "string") };
}

function swaggerTypeToOpenApi(type) {
  if (type === "integer" || type === "number" || type === "boolean") return type;
  if (type === "array" || type === "object") return type;
  return "string";
}

function extractDanetControllerRoutes(source, relPath, constants) {
  const operations = [];
  const controllerRegex = /@Controller\s*\(\s*([`'"])([\s\S]*?)\1\s*\)/g;
  for (const controllerMatch of source.matchAll(controllerRegex)) {
    const controllerBase = evaluateExpression(`${controllerMatch[1]}${controllerMatch[2]}${controllerMatch[1]}`, constants);
    if (!controllerBase || controllerBase === "{dynamic}") continue;
    const classMatch = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(source.slice(controllerMatch.index));
    const classStart = classMatch ? controllerMatch.index + classMatch.index : controllerMatch.index;
    const nextControllerMatch = /@Controller\s*\(/.exec(source.slice(controllerMatch.index + controllerMatch[0].length));
    const scanEnd = nextControllerMatch
      ? controllerMatch.index + controllerMatch[0].length + nextControllerMatch.index
      : source.length;
    const classSource = source.slice(classStart, scanEnd);
    const methodDecoratorRegex = /@(Get|Post|Put|Delete|Patch)\s*(?:\(\s*(?:([`'"])([\s\S]*?)\2)?\s*\))?/g;

    for (const decoratorMatch of classSource.matchAll(methodDecoratorRegex)) {
      const methodStart = classStart + decoratorMatch.index;
      const afterDecorator = classStart + decoratorMatch.index + decoratorMatch[0].length;
      const declarationMatch = /^\s*(?:@[A-Za-z_$][\w$]*(?:\([^)]*\))?\s*)*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/m.exec(
        source.slice(afterDecorator)
      );
      if (!declarationMatch) continue;
      const declarationStart = afterDecorator + declarationMatch.index;
      const methodName = declarationMatch[1];
      const openParen = source.indexOf("(", declarationStart);
      const args = readCallArguments(source, openParen) || [];
      const routePath = decoratorMatch[3]
        ? evaluateExpression(`${decoratorMatch[2]}${decoratorMatch[3]}${decoratorMatch[2]}`, constants)
        : "";
      const fullPath = normalizeBackendRoutePath(joinUrl(controllerBase, routePath));
      const queryParams = extractDanetQueryParameters(args);
      const openapiParameters = extractDanetPathParameterSchemas(args);
      const hasBody = args.some((arg) => /@Body\s*\(/.test(arg));
      const usesRequestFormData = args.some((arg) => /@Req\s*\(/.test(arg)) && /formData\s*\(/.test(source.slice(declarationStart, declarationStart + 1500));

      operations.push({
        index: methodStart,
        operationName: methodName,
        method: normalizeMethod(decoratorMatch[1]),
        url: fullPath,
        paramsExpression: "",
        dataExpression: hasBody ? "{}" : usesRequestFormData ? "FormData" : "",
        headersExpression: usesRequestFormData ? "multipart/form-data" : "",
        responseType: "",
        description: "",
        queryParams,
        openapiParameters,
        handlerFound: true
      });
    }
  }
  return operations;
}

function extractDanetQueryParameters(args) {
  const queryParams = [];
  for (const arg of args) {
    const namedQuery = /@Query\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/.exec(arg);
    if (namedQuery) queryParams.push(namedQuery[1]);
  }
  return [...new Set(queryParams)].sort();
}

function extractDanetPathParameterSchemas(args) {
  const parameters = [];
  for (const arg of args) {
    const namedParam = /@Param\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/.exec(arg);
    if (!namedParam) continue;
    const typeMatch = /:\s*([A-Za-z_$][\w$]*)/.exec(arg);
    parameters.push({
      name: namedParam[1],
      in: "path",
      required: true,
      schema: schemaFromTypeName(typeMatch?.[1])
    });
  }
  return parameters;
}

function schemaFromTypeName(typeName = "string") {
  if (typeName === "number") return { type: "number" };
  if (typeName === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function extractBackendRouteCalls(source, relPath, constants) {
  const operations = [];
  const routeRegex = /\b(?:app|router|this\.router)\s*\.\s*(get|post|put|delete|patch)\s*\(/gi;
  for (const match of source.matchAll(routeRegex)) {
    const openParen = source.indexOf("(", match.index);
    const args = readCallArguments(source, openParen);
    if (!args?.[0]) continue;
    const routePath = evaluateExpression(args[0], constants);
    if (!routePath || routePath === "{dynamic}") continue;
    if (routePath.includes("{basePath}") || routePath.includes("{slice}") || routePath === "url") continue;
    const routeOptions = args[1] || "";
    const handlerExpression = args[args.length - 1] || "";
    operations.push({
      index: match.index,
      operationName: findOperationName(source, match.index),
      method: normalizeMethod(match[1]),
      url: expressPathToOpenApi(routePath),
      paramsExpression: "",
      dataExpression: ["post", "put", "patch"].includes(normalizeMethod(match[1])) || /\bbody\s*:/.test(routeOptions) ? "{}" : "",
      headersExpression: "",
      responseType: "",
      description: extractSchemaDescription(routeOptions),
      handlerFound: isLikelyRouteHandler(handlerExpression)
    });
  }
  return operations;
}

function resolveBackendPath(routePath, prefixes) {
  const route = normalizeBackendRoutePath(routePath);
  if (!route || route === "/") {
    return normalizeBackendRoutePath(prefixes.find(Boolean) || route);
  }
  if (KNOWN_PREFIXES.some((prefix) => stripLeadingSlash(route).startsWith(prefix))) {
    return route;
  }
  const prefix = prefixes.find((candidate) => candidate && candidate !== "/") || "";
  return normalizeBackendRoutePath(joinUrl(prefix, route));
}

function normalizeBackendRoutePath(routePath) {
  return normalizeOpenApiPath(`/${stripLeadingSlash(expressPathToOpenApi(routePath))}`);
}

function expressPathToOpenApi(routePath) {
  return String(routePath || "")
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/:([A-Za-z_$][\w$]*)/g, "{$1}")
    .replace(/\(\.\*\)/g, "{wildcard}")
    .replace(/\*/g, "{wildcard}");
}

function extractClassNames(source) {
  return [...source.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
}

function getFunctionNameFromPath(file, functionsRoot) {
  return path.relative(functionsRoot, file).split(path.sep)[0];
}

function dedupeBackendOperations(operations) {
  const byKey = new Map();
  for (const operation of operations) {
    const key = `${operation.method} ${operation.url}`;
    const sourceRef = `${operation.sourcePath}:${operation.sourceLine}`;
    operation.backendSources = [...new Set([...(operation.backendSources || []), sourceRef])];
    if (!byKey.has(key)) {
      byKey.set(key, operation);
      continue;
    }
    const existing = byKey.get(key);
    existing.backendSources = [...new Set([...(existing.backendSources || []), ...operation.backendSources])];
    if (!existing.description && operation.description) existing.description = operation.description;
    if (!(existing.openapiParameters || []).length && (operation.openapiParameters || []).length) {
      existing.openapiParameters = operation.openapiParameters;
    }
    if (!existing.dataExpression && operation.dataExpression) existing.dataExpression = operation.dataExpression;
    if (operation.handlerFound) {
      existing.handlerFound = true;
      existing.handlerSources = [...new Set([...(existing.handlerSources || []), ...(operation.handlerSources || [])])];
    }
  }
  return [...byKey.values()];
}

function extractSchemaDescription(routeOptions) {
  const match = /\bdescription\s*:\s*(["'`])([\s\S]*?)\1/.exec(routeOptions || "");
  return match ? match[2].replace(/\s+/g, " ").trim() : "";
}

function isLikelyRouteHandler(expression) {
  const text = String(expression || "").trim();
  if (!text) return false;
  if (/^(async\s*)?\([^)]*\)\s*=>/.test(text)) return true;
  if (/^async\s+function\b/.test(text)) return true;
  if (/\.bind\(this\)/.test(text)) return true;
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(text)) return true;
  return false;
}

function resolveImportPath(file, importPath) {
  if (!importPath.startsWith(".")) return "";
  const base = path.resolve(path.dirname(file), importPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.js")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || base;
}

function unquoteYamlValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+#.*$/, "")
    .replace(/^["']|["']$/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseObjectProperties(objectText) {
  const text = objectText.trim();
  const body = text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
  const props = new Map();
  for (const part of splitTopLevel(body, ",")) {
    const colon = indexOfTopLevel(part, ":");
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim().replace(/^["']|["']$/g, "");
    const value = part.slice(colon + 1).trim().replace(/,$/, "");
    if (key) props.set(key, value);
  }
  return props;
}

export function evaluateExpression(expression, constants = new Map()) {
  let value = String(expression || "").trim();
  if (!value) return "";
  value = value.replace(/;$/, "").trim();

  if (value.startsWith("this.")) {
    const key = value.slice("this.".length);
    if (constants.has(key)) return constants.get(key);
    if (constants.has(key[0]?.toUpperCase() + key.slice(1))) return constants.get(key[0].toUpperCase() + key.slice(1));
    if (key === "baseURL") return "{PUBLIC_WEBAPI_PROXY_URL}";
  }

  if (constants.has(value)) {
    const constantValue = constants.get(value);
    return constantValue.includes("${") ? evaluateExpression(`\`${constantValue}\``, constants) : constantValue;
  }

  const concatParts = splitTopLevel(value, "+");
  if (concatParts.length > 1) {
    return concatParts
      .map((part) => evaluateExpression(part, constants))
      .filter((part) => part && part !== "{dynamic}")
      .join("");
  }

  const quote = value[0];
  if ((quote === "\"" || quote === "'" || quote === "`") && value.endsWith(quote)) {
    const inner = value.slice(1, -1);
    if (quote === "`") {
      return inner.replace(/\$\{([^}]+)\}/g, (_, expr) => {
        const trimmed = expr.trim();
        if (constants.has(trimmed)) return constants.get(trimmed);
        if (trimmed.startsWith("this.")) return evaluateExpression(trimmed, constants);
        return `{${parameterNameFromExpression(expr)}}`;
      });
    }
    return inner;
  }

  const envMatch = /env\.([A-Z0-9_]+)/.exec(value) || /REACT_APP_[A-Z0-9_]+/.exec(value);
  if (envMatch) return `{${envMatch[1] || envMatch[0]}}`;

  return value.includes("?") || value.includes("(") ? "{dynamic}" : value;
}

function findKnownPrefix(url, rawBaseUrl) {
  const normalized = stripLeadingSlash(url);
  const normalizedBase = stripLeadingSlash(rawBaseUrl || "");
  if (normalized.includes("PUBLIC_WEBAPI_PROXY_URL")) return "public-webapi-proxy";
  if (normalizedBase) {
    if (normalizedBase.includes("PUBLIC_WEBAPI_PROXY_URL")) return "public-webapi-proxy";
    const basePrefix = KNOWN_PREFIXES.find((prefix) => normalizedBase === prefix || normalizedBase.startsWith(`${prefix}/`));
    if (basePrefix) return normalizedBase;
    return normalizedBase.split("?")[0];
  }
  return KNOWN_PREFIXES.find((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function extractParamsObjectKeys(expression) {
  if (!expression) return [];
  const text = expression.trim();
  if (text === "params" || text.includes("URLSearchParams")) return [];
  if (!text.startsWith("{")) return [];
  const body = text.slice(1, text.endsWith("}") ? -1 : undefined);
  const keys = [];
  for (const part of splitTopLevel(body, ",")) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith("...")) continue;
    const colon = indexOfTopLevel(trimmed, ":");
    const key = colon >= 0 ? trimmed.slice(0, colon).trim() : trimmed;
    if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.push(key);
  }
  return keys;
}

function extractQueryParams(queryString = "") {
  if (!queryString) return [];
  return queryString
    .split("&")
    .map((part) => part.split("=")[0])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => name.replace(/[{}]/g, ""));
}

function extractPathParams(openApiPath) {
  return [...openApiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function normalizeOpenApiPath(input) {
  return input
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .replace(/\{encodeURIComponent\(([^)]+)\)\}/g, "{$1}") || "/";
}

function parameterNameFromExpression(expression) {
  const encoded = /encodeURIComponent\(([^)]+)\)/.exec(expression);
  const raw = (encoded?.[1] || expression).trim();
  const dotPart = raw.split(".").pop();
  const match = /[A-Za-z_$][\w$]*/.exec(dotPart || "dynamic");
  return match ? match[0] : "dynamic";
}

function paramToOpenApi(name, required) {
  return {
    name,
    in: required ? "path" : "query",
    required,
    schema: { type: "string" }
  };
}

function upsertParameter(parameters, param) {
  if (!parameters.some((existing) => existing.name === param.name && existing.in === param.in)) {
    parameters.push(param);
  }
}

function readCallArguments(source, openParenIndex) {
  const call = readBalanced(source, openParenIndex, "(", ")");
  if (!call) return null;
  return splitTopLevel(call.text.slice(1, -1), ",");
}

function readBalanced(source, start, open, close) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote && !(quote === "`" && prev === "$")) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return { text: source.slice(start, i + 1), end: i + 1 };
  }
  return null;
}

function splitTopLevel(text, delimiter) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") depth += 1;
    if (char === "}" || char === ")" || char === "]") depth -= 1;
    if (depth === 0 && text.startsWith(delimiter, i)) {
      parts.push(text.slice(start, i).trim());
      start = i + delimiter.length;
      i += delimiter.length - 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function indexOfTopLevel(text, target) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") depth += 1;
    if (char === "}" || char === ")" || char === "]") depth -= 1;
    if (depth === 0 && char === target) return i;
  }
  return -1;
}

function findOperationName(source, index) {
  const prefix = source.slice(Math.max(0, index - 1500), index);
  const patterns = [
    /(?:public|private|protected)?\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{=]+)?\s*\{/gm,
    /(?:public|private|protected)?\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>/gm,
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /function\s+([A-Za-z_$][\w$]*)/gm
  ];
  let best = null;
  for (const pattern of patterns) {
    for (const match of prefix.matchAll(pattern)) {
      if (!best || match.index > best.index) best = { index: match.index, name: match[1] };
    }
  }
  return best?.name || "uiApiCall";
}

function uniqueOperationId(method, openApiPath) {
  return `${method}_${openApiPath}`
    .replace(/[^A-Za-z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, "")
    .replace(/^[0-9]/, "_$&");
}

function summaryFromName(name, method, openApiPath) {
  if (name && name !== "uiApiCall") return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${method.toUpperCase()} ${openApiPath}`;
}

function sortParameters(parameters) {
  const byKey = new Map();
  for (const parameter of parameters) {
    const key = `${parameter.in}:${parameter.name}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.description && parameter.description)) {
      byKey.set(key, parameter);
    }
  }
  return [...byKey.values()].sort((a, b) => `${a.in}:${a.name}`.localeCompare(`${b.in}:${b.name}`));
}

function findEquivalentPath(paths, targetPath, method) {
  const targetShape = parameterShape(targetPath);
  return Object.keys(paths).find((pathKey) => paths[pathKey][method] && parameterShape(pathKey) === targetShape);
}

function parameterShape(openApiPath) {
  return openApiPath.replace(/\{[^}]+\}/g, "{}");
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function tagObjects(tagNames) {
  return [...tagNames].sort().map((name) => {
    const description = tagDescription(name);
    return description ? { name, description } : { name };
  });
}

function tagDescription(name) {
  if (TAG_DESCRIPTIONS.has(name)) return TAG_DESCRIPTIONS.get(name);
  if (name.startsWith("ui:")) return `Operation is called by the ${name.slice("ui:".length)} UI.`;
  if (name.startsWith("backend:")) return `Operation is declared by the ${name.slice("backend:".length)} backend function.`;
  if (name.startsWith("service:")) return `Operation belongs to the ${name.slice("service:".length)} service/function surface.`;
  return "";
}

function stripD2eExtensions(value) {
  if (Array.isArray(value)) return value.map((item) => stripD2eExtensions(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("x-d2e-"))
      .map(([key, child]) => [key, stripD2eExtensions(child)])
  );
}

function serviceNameFromOperation(pathKey, operation) {
  const serviceTag = (operation.tags || []).find((tag) => tag.startsWith("service:"));
  if (serviceTag) return serviceTag.slice("service:".length);
  return slugify(firstPathSegment(pathKey)) || "root";
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getAppName(relPath) {
  const parts = relPath.split("/");
  const appsIndex = parts.indexOf("apps");
  return appsIndex >= 0 ? parts[appsIndex + 1] || "ui" : "ui";
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function cleanUrl(url) {
  return String(url || "").trim().replace(/^['"`]|['"`]$/g, "").replace(/\/+$/, "");
}

function joinUrl(base, url) {
  if (!base) return url;
  if (!url) return base;
  return `${base}/${stripLeadingSlash(url)}`;
}

function stripLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function firstPathSegment(url) {
  const parts = stripLeadingSlash(url).split("/").filter(Boolean);
  return parts[0] || "";
}

function slugify(value) {
  return stripLeadingSlash(value)
    .replace(/\{[^}]+\}/g, "dynamic")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeMethod(method) {
  return String(method || "GET").trim().replace(/^["'`]|["'`]$/g, "").toLowerCase();
}

function skipWhitespace(source, index) {
  let i = index;
  while (/\s/.test(source[i])) i += 1;
  return i;
}
