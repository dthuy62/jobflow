import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ErrorResponseDtoSchema, HealthDtoSchema } from "../contracts/index.js";

export interface BuildOpenApiDocumentOptions {
  readonly serverUrl?: string;
}

export interface OpenApiDocument {
  readonly openapi: "3.1.0";
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description: string;
  };
  readonly servers: ReadonlyArray<{
    readonly url: string;
    readonly description: string;
  }>;
  readonly tags: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
  }>;
  readonly paths: {
    readonly "/api/v1/health": {
      readonly get: {
        readonly operationId: "getHealth";
        readonly tags: readonly ["Health"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly [];
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
    };
  };
  readonly components: {
    readonly schemas: {
      readonly HealthDto: JsonSchemaObject;
      readonly ErrorResponseDto: JsonSchemaObject;
    };
    readonly examples: {
      readonly HealthReady: OpenApiExample;
      readonly HealthNotReady: OpenApiExample;
      readonly ValidationError: OpenApiExample;
      readonly UnauthorizedError: OpenApiExample;
      readonly WorkspaceUnhealthyError: OpenApiExample;
      readonly UnexpectedError: OpenApiExample;
    };
    readonly securitySchemes: {
      readonly LocalPairingToken: {
        readonly type: "apiKey";
        readonly in: "header";
        readonly name: "X-Career-Ops-Token";
        readonly description: string;
      };
    };
  };
}

type JsonSchemaObject = Record<string, unknown>;

interface OpenApiExample {
  readonly summary: string;
  readonly value: unknown;
}

interface OpenApiJsonResponse {
  readonly description: string;
  readonly content: {
    readonly "application/json": {
      readonly schema: {
        readonly $ref: string;
      };
      readonly examples?: Record<string, { readonly $ref: string } | OpenApiExample>;
    };
  };
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const examples = {
  healthReady: HealthDtoSchema.parse(readJsonExample("contracts/examples/health.ready.json")),
  healthNotReady: HealthDtoSchema.parse(readJsonExample("contracts/examples/health.not-ready.json")),
  validationError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/validation.json")
  ),
  unauthorizedError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/unauthorized.json")
  ),
  workspaceUnhealthyError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/workspace-unhealthy.json")
  ),
  unexpectedError: ErrorResponseDtoSchema.parse({
    error: {
      code: "UNEXPECTED_ERROR",
      message: "An unexpected error occurred."
    }
  })
} as const;

export function buildOpenApiDocument(options: BuildOpenApiDocumentOptions = {}): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "Career Ops Wrapper API",
      version: "1.0.0",
      description:
        "Local-first wrapper API for Career Ops Mobile. The current documented surface includes setup/readiness endpoints only. /docs and /openapi.json are public setup/developer endpoints and do not require the Local Pairing Token."
    },
    servers: [
      {
        url: options.serverUrl ?? "/",
        description: "Current wrapper origin"
      }
    ],
    tags: [
      {
        name: "Health",
        description: "Wrapper and Career Ops Workspace readiness checks"
      }
    ],
    paths: {
      "/api/v1/health": {
        get: {
          operationId: "getHealth",
          tags: ["Health"],
          summary: "Get wrapper and workspace readiness",
          description:
            "Returns API, workspace, local script runner, and implemented capability readiness. This endpoint is public in localhost and LAN mode.",
          security: [],
          responses: {
            "200": jsonResponse("Wrapper health and readiness state.", "HealthDto", {
              ready: { $ref: "#/components/examples/HealthReady" },
              notReady: { $ref: "#/components/examples/HealthNotReady" }
            }),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto", {
              unexpected: { $ref: "#/components/examples/UnexpectedError" }
            })
          }
        }
      }
    },
    components: {
      schemas: {
        HealthDto: schemaFromZod(HealthDtoSchema),
        ErrorResponseDto: schemaFromZod(ErrorResponseDtoSchema)
      },
      examples: {
        HealthReady: {
          summary: "Ready workspace and scanner prerequisites",
          value: examples.healthReady
        },
        HealthNotReady: {
          summary: "Missing workspace and scanner prerequisites",
          value: examples.healthNotReady
        },
        ValidationError: {
          summary: "Validation error response",
          value: examples.validationError
        },
        UnauthorizedError: {
          summary: "Missing or invalid Local Pairing Token",
          value: examples.unauthorizedError
        },
        WorkspaceUnhealthyError: {
          summary: "Career Ops Workspace is not ready",
          value: examples.workspaceUnhealthyError
        },
        UnexpectedError: {
          summary: "Unexpected wrapper error response",
          value: examples.unexpectedError
        }
      },
      securitySchemes: {
        LocalPairingToken: {
          type: "apiKey",
          in: "header",
          name: "X-Career-Ops-Token",
          description:
            "Local Pairing Token for protected API routes in LAN/private mode. GET /api/v1/health, /docs, and /openapi.json are public setup/developer endpoints. This is not user authentication, not Firebase App Check, and not a public API key."
        }
      }
    }
  };
}

function jsonResponse(
  description: string,
  schemaName: string,
  examplesByName?: Record<string, { readonly $ref: string } | OpenApiExample>
): OpenApiJsonResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`
        },
        ...(examplesByName ? { examples: examplesByName } : {})
      }
    }
  };
}

function schemaFromZod(schema: z.ZodType): JsonSchemaObject {
  return z.toJSONSchema(schema) as JsonSchemaObject;
}

function readJsonExample(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(packageRoot, relativePath), "utf8"));
}
