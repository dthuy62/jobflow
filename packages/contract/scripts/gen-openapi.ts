import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument, serializeOpenApiDocument } from "../src/openapi.js";

const examplesDir = fileURLToPath(new URL("../../../contracts/examples", import.meta.url));
const output = fileURLToPath(new URL("../../../contracts/openapi.json", import.meta.url));

writeFileSync(output, serializeOpenApiDocument(buildOpenApiDocument(examplesDir)));
console.log(`Wrote ${output}`);
