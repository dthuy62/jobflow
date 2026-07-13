import scalarApiReference from "@scalar/fastify-api-reference";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildOpenApiDocument } from "../openapi/openapi-document.js";

const docsPageTitle = "Career Ops Wrapper API Docs";
const docsSelectableTextCss = `
.scalar-app .references-rendered,
.scalar-app .references-rendered * {
  user-select: text;
}
`.trim();

export async function registerDocsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/openapi.json", async (request, reply) => {
    return reply
      .type("application/json")
      .send(buildOpenApiDocument({ serverUrl: inferServerUrl(request) }));
  });

  server.get("/docs", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderDocsHtml());
  });

  await server.register(scalarApiReference, {
    routePrefix: "/docs-assets",
    configuration: {
      pageTitle: docsPageTitle,
      url: "/openapi.json",
      content: () => buildOpenApiDocument(),
      customCss: docsSelectableTextCss
    },
    logLevel: "silent"
  });
}

function inferServerUrl(request: FastifyRequest): string {
  const host = request.headers.host;
  const forwardedProto = request.headers["x-forwarded-proto"];

  if (!host || Array.isArray(host)) {
    return "/";
  }

  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? request.protocol;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return "/";
  }
}

function renderDocsHtml(): string {
  const configuration = JSON.stringify({
    url: "/openapi.json",
    customCss: docsSelectableTextCss
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <title>${docsPageTitle}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/docs-assets/js/scalar.js"></script>
    <script>
      Scalar.createApiReference("#app", ${configuration});
    </script>
  </body>
</html>`;
}
