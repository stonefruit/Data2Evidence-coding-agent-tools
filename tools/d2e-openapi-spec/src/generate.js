#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCombinedSpec, extractBackendOperations, extractFromFile, listSourceFiles, splitSpecByService } from "./extractor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "../..");
const appRepo = path.resolve(process.env.D2E_APP_REPO || path.join(workspaceRoot, "repos/Data2Evidence"));
const uiRoot = path.join(appRepo, "plugins/ui/apps");
const functionsRoot = path.join(appRepo, "plugins/functions");
const outputDir = path.join(workspaceRoot, "docs/openapi/specs");

if (!fs.existsSync(uiRoot)) {
  console.error(`UI source root not found: ${uiRoot}`);
  process.exit(1);
}

const files = listSourceFiles(uiRoot);
const uiOperations = files.flatMap((file) => extractFromFile(file, appRepo));
const backendOperations = fs.existsSync(functionsRoot) ? extractBackendOperations(functionsRoot, appRepo) : [];
const combinedSpec = buildCombinedSpec(uiOperations, backendOperations, {
  generatedFrom: {
    ui: path.relative(workspaceRoot, uiRoot).split(path.sep).join("/"),
    backend: path.relative(workspaceRoot, functionsRoot).split(path.sep).join("/")
  }
});
const serviceSpecs = splitSpecByService(combinedSpec);

fs.mkdirSync(outputDir, { recursive: true });
for (const file of fs.readdirSync(outputDir)) {
  if (file.endsWith(".openapi.json")) {
    fs.unlinkSync(path.join(outputDir, file));
  }
}

for (const [serviceName, spec] of serviceSpecs) {
  fs.writeFileSync(path.join(outputDir, `${serviceName}.openapi.json`), `${JSON.stringify(spec, null, 2)}\n`);
}

console.log(`Scanned ${files.length} UI source files.`);
console.log(`Discovered ${uiOperations.length} UI API calls.`);
console.log(`Discovered ${backendOperations.length} backend routes.`);
console.log(`Wrote ${serviceSpecs.size} OpenAPI specs to ${path.relative(process.cwd(), outputDir)}.`);
