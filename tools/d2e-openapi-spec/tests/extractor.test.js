import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildCombinedSpec,
  buildServiceSpecs,
  evaluateExpression,
  extractBackendOperations,
  extractFromFile,
  parseObjectProperties,
  parseSwaggerYaml,
  splitSpecByService
} from "../src/extractor.js";

test("evaluates template paths as OpenAPI path parameters", () => {
  const constants = new Map([["BASE_URL", "system-portal/"]]);
  assert.equal(evaluateExpression("BASE_URL", constants), "system-portal/");
  assert.equal(evaluateExpression("`dataset/${datasetId}/transform-to-webapi`", constants), "dataset/{datasetId}/transform-to-webapi");
  assert.equal(evaluateExpression("`plugins/${encodeURIComponent(name)}`", constants), "plugins/{name}");
});

test("parses top-level request object properties without flattening nested data", () => {
  const props = parseObjectProperties(`{
    baseURL: JOBPLUGIN_URL,
    url: "prefect/flow-run/metadata",
    method: "POST",
    data: { nested: { ok: true }, list: [1, 2] },
  }`);

  assert.equal(props.get("baseURL"), "JOBPLUGIN_URL");
  assert.equal(props.get("url"), "\"prefect/flow-run/metadata\"");
  assert.equal(props.get("method"), "\"POST\"");
  assert.match(props.get("data"), /nested/);
});

test("extracts object calls through local client wrapper", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "d2e-openapi-test-"));
  const file = path.join(root, "plugins/ui/apps/vue-mri-ui-lib/src/query-filter/services/D2eWebapiService.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `const D2E_WEBAPI_BASE_URL = "d2e-webapi";
     export async function getInclusionReport(cohortDefinitionId, sourceKey, modeId) {
       return client({
         baseURL: D2E_WEBAPI_BASE_URL,
         url: \`/cohortdefinition/\${cohortDefinitionId}/report/\${sourceKey}?mode=\${modeId}\`,
         method: "GET",
         headers: { datasetid: sourceKey },
       });
     }`
  );

  const operations = extractFromFile(file, root);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].baseURL, "d2e-webapi");
  assert.equal(operations[0].url, "/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}?mode={modeId}");
});

test("groups operations into service specs and query parameters", () => {
  const specs = buildServiceSpecs([
    {
      sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
      sourceLine: 42,
      appName: "portal",
      operationName: "getDataset",
      method: "get",
      baseURL: "system-portal/",
      url: "dataset",
      paramsExpression: "{ datasetId: id }"
    },
    {
      sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
      sourceLine: 58,
      appName: "portal",
      operationName: "transformToWebApi",
      method: "post",
      baseURL: "system-portal/",
      url: "dataset/{datasetId}/transform-to-webapi",
      dataExpression: ""
    }
  ]);

  const spec = specs.get("system-portal");
  assert.ok(spec);
  assert.equal(spec.servers[0].url, "/system-portal");
  assert.ok(spec.paths["/dataset"].get);
  assert.deepEqual(spec.paths["/dataset"].get.parameters[0], {
    name: "datasetId",
    in: "query",
    required: false,
    schema: { type: "string" }
  });
  assert.ok(spec.paths["/dataset/{datasetId}/transform-to-webapi"].post);
});

test("combined spec tags UI-used and backend-only operations", () => {
  const spec = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
        sourceLine: 42,
        appName: "portal",
        operationName: "getDataset",
        method: "get",
        baseURL: "system-portal/",
        url: "dataset",
        paramsExpression: "{ datasetId: id }"
      },
      {
        sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
        sourceLine: 50,
        appName: "portal",
        operationName: "getDataset",
        method: "get",
        baseURL: "system-portal/",
        url: "unmatched"
      }
    ],
    [
      {
        sourcePath: "plugins/functions/portal/index.ts",
        sourceLine: 10,
        appName: "backend",
        backendFunction: "portal",
        operationName: "getDataset",
        method: "get",
        baseURL: "",
        url: "/system-portal/dataset",
        paramsExpression: "{ datasetId: id }"
      },
      {
        sourcePath: "plugins/functions/portal/index.ts",
        sourceLine: 20,
        appName: "backend",
        backendFunction: "portal",
        operationName: "internalRoute",
        method: "post",
        baseURL: "",
        url: "/system-portal/internal",
        dataExpression: "{}"
      }
    ]
  );

  assert.ok(spec.paths["/system-portal/dataset"].get.tags.includes("ui-used"));
  assert.ok(spec.paths["/system-portal/dataset"].get.tags.includes("backend-implemented"));
  assert.ok(!spec.paths["/system-portal/dataset"].get.tags.includes("backend-only"));
  assert.ok(spec.paths["/system-portal/unmatched"].get.tags.includes("handler-unresolved"));
  assert.notEqual(
    spec.paths["/system-portal/dataset"].get.operationId,
    spec.paths["/system-portal/unmatched"].get.operationId
  );
  assert.ok(spec.paths["/system-portal/internal"].post.tags.includes("backend-only"));
  assert.equal(
    spec.tags.find((tag) => tag.name === "ui-used")?.description,
    "Operation is called by at least one Data2Evidence UI."
  );
  assert.equal(hasD2eExtension(spec), false);
});

test("combined spec marks traced missing d2e-webapi report endpoint", () => {
  const spec = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/vue-mri-ui-lib/src/query-filter/services/D2eWebapiService.ts",
        sourceLine: 10,
        appName: "vue-mri-ui-lib",
        operationName: "getInclusionReport",
        method: "get",
        baseURL: "d2e-webapi",
        url: "/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}?mode={modeId}",
        paramsExpression: ""
      }
    ],
    []
  );

  const operation = spec.paths["/d2e-webapi/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}"].get;
  assert.ok(operation.tags.includes("ui-used"));
  assert.ok(operation.tags.includes("backend-missing"));
  assert.ok(operation.tags.includes("handler-unresolved"));
  assert.match(operation.description, /No matching d2e-webapi backend route/);
  assert.equal(operation.parameters.find((param) => param.name === "datasetid")?.in, "header");
  assert.equal(operation.parameters.some((param) => param.description), false);
  assert.equal(hasD2eExtension(spec), false);
});

test("splits combined spec into normal OpenAPI service files with tags", () => {
  const combined = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
        sourceLine: 42,
        appName: "portal",
        operationName: "getDataset",
        method: "get",
        baseURL: "system-portal/",
        url: "dataset",
        paramsExpression: "{ datasetId: id }"
      },
      {
        sourcePath: "plugins/ui/apps/vue-mri-ui-lib/src/query-filter/services/D2eWebapiService.ts",
        sourceLine: 10,
        appName: "vue-mri-ui-lib",
        operationName: "getInclusionReport",
        method: "get",
        baseURL: "d2e-webapi",
        url: "/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}?mode={modeId}",
        paramsExpression: ""
      }
    ],
    []
  );

  const specs = splitSpecByService(combined);
  assert.ok(specs.get("system-portal").paths["/system-portal/dataset"].get);
  assert.ok(specs.get("d2e-webapi").paths["/d2e-webapi/cohortdefinition/{cohortDefinitionId}/report/{sourceKey}"].get);
  assert.ok(specs.get("d2e-webapi").tags.some((tag) => tag.name === "backend-missing"));
  assert.equal(
    specs.get("d2e-webapi").tags.find((tag) => tag.name === "ui:vue-mri-ui-lib")?.description,
    "Operation is called by the vue-mri-ui-lib UI."
  );
  assert.equal(hasD2eExtension(specs.get("d2e-webapi")), false);
});

test("adds terminology examples and removes generated parameter descriptions", () => {
  const spec = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/concept-sets/src/axios/terminology.ts",
        sourceLine: 20,
        appName: "concept-sets",
        operationName: "getTerminologies",
        method: "get",
        baseURL: "terminology",
        url: "/fhir/4_0_0/valueset/$expand?params",
        paramsExpression: ""
      },
      {
        sourcePath: "plugins/ui/apps/concept-sets/src/axios/terminology.ts",
        sourceLine: 120,
        appName: "concept-sets",
        operationName: "createConceptSet",
        method: "post",
        baseURL: "terminology",
        url: "/concept-set?datasetId={datasetId}",
        dataExpression: "conceptSet"
      }
    ],
    []
  );

  const expandOperation = spec.paths["/terminology/fhir/4_0_0/valueset/$expand"].get;
  assert.ok(!expandOperation.parameters.some((param) => param.name === "params"));
  assert.equal(expandOperation.parameters.find((param) => param.name === "datasetId")?.example, "4f05abcf-36d6-4e88-a44d-ad1ee3a0b06e");
  assert.equal(expandOperation.responses["200"].content["application/json"].example.resourceType, "ValueSet");
  assert.equal(expandOperation.parameters.some((param) => param.description), false);

  const createConceptSetOperation = spec.paths["/terminology/concept-set"].post;
  assert.equal(createConceptSetOperation.requestBody.content["application/json"].example.name, "Example condition set");
  assert.equal(createConceptSetOperation.responses["200"].content["application/json"].example, 12);
});

test("adds d2e-webapi examples with synthetic values", () => {
  const spec = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/concept-sets/src/axios/d2e-webapi.ts",
        sourceLine: 20,
        appName: "concept-sets",
        operationName: "getTerminologies",
        method: "post",
        baseURL: "d2e-webapi",
        url: "/vocabulary/{datasetId}/search?params",
        paramsExpression: "",
        dataExpression: "data"
      },
      {
        sourcePath: "plugins/ui/apps/vue-mri-ui-lib/src/query-filter/services/D2eWebapiService.ts",
        sourceLine: 30,
        appName: "vue-mri-ui-lib",
        operationName: "getConceptSetExpression",
        method: "get",
        baseURL: "d2e-webapi",
        url: "/conceptset/{conceptSetId}/expression",
        paramsExpression: "{ datasetId }"
      },
      {
        sourcePath: "plugins/ui/apps/vue-mri-ui-lib/src/query-filter/services/D2eWebapiService.ts",
        sourceLine: 40,
        appName: "vue-mri-ui-lib",
        operationName: "deleteConceptSet",
        method: "delete",
        baseURL: "d2e-webapi",
        url: "/conceptset/{conceptSetId}",
        paramsExpression: ""
      }
    ],
    []
  );

  const searchOperation = spec.paths["/d2e-webapi/vocabulary/{datasetId}/search"].post;
  assert.ok(!searchOperation.parameters.some((param) => param.name === "params"));
  assert.equal(searchOperation.parameters.find((param) => param.name === "rowsPerPage")?.example, 25);
  assert.equal(searchOperation.requestBody.content["application/json"].example.VOCABULARY_ID[0], "EXAMPLE");
  assert.equal(searchOperation.responses["200"].content["application/json"].example[0].CONCEPT_CODE, "EXAMPLE-001");
  assert.equal(searchOperation.parameters.some((param) => param.description), false);

  const expressionOperation = spec.paths["/d2e-webapi/conceptset/{conceptSetId}/expression"].get;
  assert.equal(expressionOperation.parameters.find((param) => param.name === "datasetid")?.example, "4f05abcf-36d6-4e88-a44d-ad1ee3a0b06e");
  assert.equal(expressionOperation.responses["200"].content["application/json"].example.items[0].concept.VOCABULARY_ID, "EXAMPLE");

  const deleteOperation = spec.paths["/d2e-webapi/conceptset/{conceptSetId}"].delete;
  assert.ok(deleteOperation.responses["204"]);
  assert.ok(!deleteOperation.responses["200"]);
  assert.ok(!deleteOperation.responses["204"].content);
  assert.equal(
    spec.components.schemas.UnknownJson.type,
    "object"
  );
});

test("extracts Danet controller routes as traced backend handlers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "d2e-openapi-backend-test-"));
  const functionsRoot = path.join(root, "plugins/functions");
  const packagePath = path.join(functionsRoot, "package.json");
  fs.mkdirSync(path.dirname(packagePath), { recursive: true });
  fs.writeFileSync(
    packagePath,
    JSON.stringify({
      trex: {
        functions: {
          api: [{ source: "/system-portal", function: "/portal", env: "portal" }],
          env: { portal: {} }
        }
      }
    })
  );

  const controller = path.join(functionsRoot, "portal/src/dataset/dataset.controller.ts");
  fs.mkdirSync(path.dirname(controller), { recursive: true });
  fs.writeFileSync(
    controller,
    `import { Body, Controller, Get, Param, Post, Query } from "@danet/core";
     @Controller("system-portal/dataset")
     export class DatasetController {
       @Get("release/:id")
       async getReleaseById(@Param("id") id: number) {
         return {};
       }

       @Post(":id/transform-to-webapi")
       async transformToWebApi(@Param("id") id: string, @Body() body: unknown) {
         return {};
       }

       @Get("dashboard-code")
       async getDatasetDashboardCode(@Query("datasetId") datasetId: string, @Query("type") type: string) {
         return {};
       }
     }`
  );

  const operations = extractBackendOperations(functionsRoot, root);
  const release = operations.find((operation) => operation.method === "get" && operation.url === "/system-portal/dataset/release/{id}");
  const transform = operations.find((operation) => operation.method === "post" && operation.url === "/system-portal/dataset/{id}/transform-to-webapi");
  const dashboard = operations.find((operation) => operation.method === "get" && operation.url === "/system-portal/dataset/dashboard-code");

  assert.ok(release?.handlerFound);
  assert.equal(release.openapiParameters.find((param) => param.name === "id")?.schema.type, "number");
  assert.ok(transform?.dataExpression);
  assert.deepEqual(dashboard.queryParams, ["datasetId", "type"]);
});

test("adds system-portal examples and object-shaped UnknownJson fallback", () => {
  const spec = buildCombinedSpec(
    [
      {
        sourcePath: "plugins/ui/apps/portal/src/axios/system-portal.ts",
        sourceLine: 42,
        appName: "portal",
        operationName: "getDatasets",
        method: "get",
        baseURL: "system-portal/",
        url: "dataset/list",
        paramsExpression: ""
      }
    ],
    []
  );

  const operation = spec.paths["/system-portal/dataset/list"].get;
  const example = operation.responses["200"].content["application/json"].example;
  assert.equal(example[0].id, "4f05abcf-36d6-4e88-a44d-ad1ee3a0b06e");
  assert.equal(example[0].datasetDetail.name, "Example dataset");
  assert.deepEqual(spec.components.schemas.UnknownJson, {
    description: "Shape not inferred from UI or backend source.",
    type: "object",
    additionalProperties: true
  });
});

function hasD2eExtension(value) {
  if (Array.isArray(value)) return value.some((item) => hasD2eExtension(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => key.startsWith("x-d2e-") || hasD2eExtension(child));
}

test("parses backend Swagger 2.0 paths, parameters, and body requests", () => {
  const parsed = parseSwaggerYaml(`
swagger: "2.0"
basePath: /analytics-svc/api/services/query
paths:
  /cohort:
    post:
      description: create cohort related queries
      operationId: generateQuery
      parameters:
        - name: datasetId
          in: query
          required: true
          type: string
        - in: body
          name: queryParams
          required: true
          schema:
            type: object
      responses:
        "200":
          description: Success
`);

  assert.equal(parsed.basePath, "/analytics-svc/api/services/query");
  assert.equal(parsed.operations.length, 1);
  assert.equal(parsed.operations[0].path, "/cohort");
  assert.equal(parsed.operations[0].method, "post");
  assert.equal(parsed.operations[0].hasBody, true);
  assert.deepEqual(parsed.operations[0].parameters.map((p) => [p.name, p.in, p.required, p.schema.type]), [
    ["datasetId", "query", true, "string"],
    ["queryParams", "body", true, "object"]
  ]);
});
