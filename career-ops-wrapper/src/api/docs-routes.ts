import scalarApiReference from "@scalar/fastify-api-reference";
import type { FastifyInstance } from "fastify";
import { buildOpenApiDocument } from "../openapi/openapi-document.js";

export async function registerDocsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/openapi.json", async (_request, reply) => {
    return reply.type("application/json").send(buildOpenApiDocument());
  });

  server.get("/docs", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderDocsHtml());
  });

  await server.register(scalarApiReference, {
    routePrefix: "/docs-assets",
    configuration: {
      pageTitle: "Career Ops Wrapper API Docs",
      url: "/openapi.json"
    },
    logLevel: "silent"
  });
}

function renderDocsHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <title>Career Ops Wrapper API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/docs-assets/js/scalar.js"></script>
    <script>
      Scalar.createApiReference("#app", {
        url: "/openapi.json"
      });
    </script>
  </body>
</html>`;
}
