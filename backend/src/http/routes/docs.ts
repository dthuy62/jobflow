import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";

// The repo root, from src/http/routes and from dist/http/routes alike. Compose mounts the file there in the image.
const SPEC_FILE = new URL("../../../../contracts/openapi.json", import.meta.url);
const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.0";

// The hashes make the browser refuse the files if the CDN ever serves something else.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JobFlow API</title>
<link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" integrity="sha384-4c3vsE5f+trhFyHrFrLM1fFGUn531NIaC7dcqEWIJdoRQJ5CkJbSuSCwXLpaS1KF" crossorigin="anonymous">
</head>
<body>
<div id="swagger-ui"></div>
<script src="${SWAGGER_UI}/swagger-ui-bundle.js" integrity="sha384-9Td7MKiIr2S83E1kZyyVi8KdJw/S8CpAvu0llLyMeg0xq/hDGiZJfVn0fV4llCmK" crossorigin="anonymous"></script>
<script>SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });</script>
</body>
</html>
`;

/**
 * Development only. Serves the contract on the API's own origin, so "Try it out" reaches the API
 * with no CORS. It lists every phase's routes; the ones not built yet answer 404.
 */
export function registerDocsRoutes(server: FastifyInstance): void {
  let spec: string;
  try {
    spec = readFileSync(SPEC_FILE, "utf8");
  } catch (error) {
    server.log.warn({ err: error }, "API docs are off: contracts/openapi.json was not found");
    return;
  }
  server.get("/openapi.json", { config: { public: true } }, async (_request, reply) => reply.type("application/json").send(spec));
  server.get("/docs", { config: { public: true } }, async (_request, reply) => reply.type("text/html; charset=utf-8").send(PAGE));
}
