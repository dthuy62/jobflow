import { z } from "zod";
import { ErrorResponseDtoSchema, HealthDtoSchema } from "../contracts/index.js";

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

interface OpenApiJsonResponse {
  readonly description: string;
  readonly content: {
    readonly "application/json": {
      readonly schema: {
        readonly $ref: string;
      };
    };
  };
}

export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "Career Ops Wrapper API",
      version: "1.0.0",
      description:
        "Local-first wrapper API for Career Ops Mobile. The current documented surface includes setup/readiness endpoints only."
    },
    servers: [
      {
        url: "http://127.0.0.1:3000",
        description: "Local development server"
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
            "200": jsonResponse("Wrapper health and readiness state.", "HealthDto"),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto")
          }
        }
      }
    },
    components: {
      schemas: {
        HealthDto: schemaFromZod(HealthDtoSchema),
        ErrorResponseDto: schemaFromZod(ErrorResponseDtoSchema)
      },
      securitySchemes: {
        LocalPairingToken: {
          type: "apiKey",
          in: "header",
          name: "X-Career-Ops-Token",
          description:
            "Local Pairing Token for non-health API routes in LAN/private mode. This is not user authentication, not Firebase App Check, and not a public API key."
        }
      }
    }
  };
}

function jsonResponse(description: string, schemaName: string): OpenApiJsonResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`
        }
      }
    }
  };
}

function schemaFromZod(schema: z.ZodType): JsonSchemaObject {
  return z.toJSONSchema(schema) as JsonSchemaObject;
}
