import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  CvDtoSchema,
  ErrorResponseDtoSchema,
  HealthDtoSchema,
  PortalDtoSchema,
  ProfileDtoSchema,
  SaveCvRequestDtoSchema,
  SaveProfileRequestDtoSchema
} from "../contracts/index.js";

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
    readonly "/api/v1/cv": {
      readonly get: {
        readonly operationId: "getCv";
        readonly tags: readonly ["CV"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly OpenApiSecurityRequirement[];
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "401": OpenApiJsonResponse;
          readonly "404": OpenApiJsonResponse;
          readonly "503": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
      readonly put: {
        readonly operationId: "saveCv";
        readonly tags: readonly ["CV"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly OpenApiSecurityRequirement[];
        readonly requestBody: OpenApiJsonRequestBody;
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "400": OpenApiJsonResponse;
          readonly "401": OpenApiJsonResponse;
          readonly "413": OpenApiJsonResponse;
          readonly "503": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
    };
    readonly "/api/v1/profile": {
      readonly get: {
        readonly operationId: "getProfile";
        readonly tags: readonly ["Profile"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly OpenApiSecurityRequirement[];
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "400": OpenApiJsonResponse;
          readonly "401": OpenApiJsonResponse;
          readonly "403": OpenApiJsonResponse;
          readonly "404": OpenApiJsonResponse;
          readonly "503": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
      readonly put: {
        readonly operationId: "saveProfile";
        readonly tags: readonly ["Profile"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly OpenApiSecurityRequirement[];
        readonly requestBody: OpenApiJsonRequestBody;
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "400": OpenApiJsonResponse;
          readonly "401": OpenApiJsonResponse;
          readonly "403": OpenApiJsonResponse;
          readonly "413": OpenApiJsonResponse;
          readonly "503": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
    };
    readonly "/api/v1/portals": {
      readonly get: {
        readonly operationId: "getPortals";
        readonly tags: readonly ["Portals"];
        readonly summary: string;
        readonly description: string;
        readonly security: readonly OpenApiSecurityRequirement[];
        readonly responses: {
          readonly "200": OpenApiJsonResponse;
          readonly "400": OpenApiJsonResponse;
          readonly "401": OpenApiJsonResponse;
          readonly "403": OpenApiJsonResponse;
          readonly "404": OpenApiJsonResponse;
          readonly "503": OpenApiJsonResponse;
          readonly "500": OpenApiJsonResponse;
        };
      };
    };
  };
  readonly components: {
    readonly schemas: {
      readonly HealthDto: JsonSchemaObject;
      readonly CvDto: JsonSchemaObject;
      readonly ProfileDto: JsonSchemaObject;
      readonly PortalDto: JsonSchemaObject;
      readonly SaveCvRequestDto: JsonSchemaObject;
      readonly SaveProfileRequestDto: JsonSchemaObject;
      readonly ErrorResponseDto: JsonSchemaObject;
    };
    readonly examples: {
      readonly HealthReady: OpenApiExample;
      readonly HealthNotReady: OpenApiExample;
      readonly CvValid: OpenApiExample;
      readonly ProfileValid: OpenApiExample;
      readonly PortalValid: OpenApiExample;
      readonly ValidationError: OpenApiExample;
      readonly UnauthorizedError: OpenApiExample;
      readonly PathOutsideWorkspaceError: OpenApiExample;
      readonly WorkspaceUnhealthyError: OpenApiExample;
      readonly CvMissingError: OpenApiExample;
      readonly ProfileMissingError: OpenApiExample;
      readonly PortalMissingError: OpenApiExample;
      readonly PayloadTooLargeError: OpenApiExample;
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

interface OpenApiJsonRequestBody {
  readonly required: true;
  readonly content: {
    readonly "application/json": {
      readonly schema: {
        readonly $ref: string;
      };
      readonly examples?: Record<string, OpenApiExample>;
    };
  };
}

type OpenApiSecurityRequirement = {
  readonly LocalPairingToken: readonly [];
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const examples = {
  healthReady: HealthDtoSchema.parse(readJsonExample("contracts/examples/health.ready.json")),
  healthNotReady: HealthDtoSchema.parse(readJsonExample("contracts/examples/health.not-ready.json")),
  cvValid: CvDtoSchema.parse(readJsonExample("contracts/examples/cv.valid.json")),
  profileValid: ProfileDtoSchema.parse(readJsonExample("contracts/examples/profile.valid.json")),
  portalValid: PortalDtoSchema.parse(readJsonExample("contracts/examples/portal.valid.json")),
  validationError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/validation.json")
  ),
  unauthorizedError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/unauthorized.json")
  ),
  pathOutsideWorkspaceError: ErrorResponseDtoSchema.parse({
    error: {
      code: "PATH_OUTSIDE_WORKSPACE",
      message: "Requested path is outside the configured Career Ops Workspace."
    }
  }),
  workspaceUnhealthyError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/workspace-unhealthy.json")
  ),
  cvMissingError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/cv-missing.json")
  ),
  profileMissingError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/profile-missing.json")
  ),
  portalMissingError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/portal-missing.json")
  ),
  payloadTooLargeError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/payload-too-large.json")
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
      },
      {
        name: "CV",
        description: "Read and safely save the fixed Career Ops CV Markdown file"
      },
      {
        name: "Profile",
        description: "Read and safely save normalized MVP fields for the fixed Career Ops Profile Config"
      },
      {
        name: "Portals",
        description: "Read normalized MVP fields for the fixed Career Ops Portal Config"
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
      },
      "/api/v1/cv": {
        get: {
          operationId: "getCv",
          tags: ["CV"],
          summary: "Read CV Markdown",
          description:
            "Reads the fixed CV Markdown file from the configured Career Ops Workspace and returns its Markdown content and metadata.",
          security: [{ LocalPairingToken: [] }],
          responses: {
            "200": jsonResponse("Current CV Markdown.", "CvDto", {
              current: { $ref: "#/components/examples/CvValid" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "404": jsonResponse("CV Markdown file is missing.", "ErrorResponseDto", {
              missing: { $ref: "#/components/examples/CvMissingError" }
            }),
            "503": jsonResponse("Career Ops Workspace is not ready.", "ErrorResponseDto", {
              workspace: { $ref: "#/components/examples/WorkspaceUnhealthyError" }
            }),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto", {
              unexpected: { $ref: "#/components/examples/UnexpectedError" }
            })
          }
        },
        put: {
          operationId: "saveCv",
          tags: ["CV"],
          summary: "Save CV Markdown",
          description:
            "Validates and safely replaces the fixed CV Markdown file inside the configured Career Ops Workspace, preserving the previous file before replacement.",
          security: [{ LocalPairingToken: [] }],
          requestBody: jsonRequestBody("SaveCvRequestDto", {
            markdown: {
              summary: "Markdown CV save request",
              value: {
                markdown: examples.cvValid.markdown
              }
            }
          }),
          responses: {
            "200": jsonResponse("Saved CV Markdown.", "CvDto", {
              saved: { $ref: "#/components/examples/CvValid" }
            }),
            "400": jsonResponse("Invalid CV Markdown request.", "ErrorResponseDto", {
              validation: { $ref: "#/components/examples/ValidationError" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "413": jsonResponse("CV Markdown payload is too large.", "ErrorResponseDto", {
              tooLarge: { $ref: "#/components/examples/PayloadTooLargeError" }
            }),
            "503": jsonResponse("Career Ops Workspace is not ready.", "ErrorResponseDto", {
              workspace: { $ref: "#/components/examples/WorkspaceUnhealthyError" }
            }),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto", {
              unexpected: { $ref: "#/components/examples/UnexpectedError" }
            })
          }
        }
      },
      "/api/v1/profile": {
        get: {
          operationId: "getProfile",
          tags: ["Profile"],
          summary: "Read normalized profile config",
          description:
            "Reads the first supported fixed Profile Config file from the configured Career Ops Workspace and returns normalized MVP profile fields.",
          security: [{ LocalPairingToken: [] }],
          responses: {
            "200": jsonResponse("Current normalized Profile Config.", "ProfileDto", {
              current: { $ref: "#/components/examples/ProfileValid" }
            }),
            "400": jsonResponse("Profile Config is malformed or cannot be normalized.", "ErrorResponseDto", {
              validation: { $ref: "#/components/examples/ValidationError" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": jsonResponse("Profile Config path is outside the workspace.", "ErrorResponseDto", {
              outsideWorkspace: { $ref: "#/components/examples/PathOutsideWorkspaceError" }
            }),
            "404": jsonResponse("Profile Config file is missing.", "ErrorResponseDto", {
              missing: { $ref: "#/components/examples/ProfileMissingError" }
            }),
            "503": jsonResponse("Career Ops Workspace is not ready.", "ErrorResponseDto", {
              workspace: { $ref: "#/components/examples/WorkspaceUnhealthyError" }
            }),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto", {
              unexpected: { $ref: "#/components/examples/UnexpectedError" }
            })
          }
        },
        put: {
          operationId: "saveProfile",
          tags: ["Profile"],
          summary: "Save normalized profile config",
          description:
            "Validates editable MVP Profile Config fields and safely writes the fixed Profile Config file inside the configured Career Ops Workspace.",
          security: [{ LocalPairingToken: [] }],
          requestBody: jsonRequestBody("SaveProfileRequestDto", {
            profile: {
              summary: "Editable MVP Profile Config fields",
              value: profileSaveRequestExample()
            }
          }),
          responses: {
            "200": jsonResponse("Saved normalized Profile Config.", "ProfileDto", {
              saved: { $ref: "#/components/examples/ProfileValid" }
            }),
            "400": jsonResponse("Invalid Profile Config request.", "ErrorResponseDto", {
              validation: { $ref: "#/components/examples/ValidationError" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": jsonResponse("Profile Config path is outside the workspace.", "ErrorResponseDto", {
              outsideWorkspace: { $ref: "#/components/examples/PathOutsideWorkspaceError" }
            }),
            "413": jsonResponse("Profile Config payload is too large.", "ErrorResponseDto", {
              tooLarge: { $ref: "#/components/examples/PayloadTooLargeError" }
            }),
            "503": jsonResponse("Career Ops Workspace is not ready.", "ErrorResponseDto", {
              workspace: { $ref: "#/components/examples/WorkspaceUnhealthyError" }
            }),
            "500": jsonResponse("Unexpected wrapper error response.", "ErrorResponseDto", {
              unexpected: { $ref: "#/components/examples/UnexpectedError" }
            })
          }
        }
      },
      "/api/v1/portals": {
        get: {
          operationId: "getPortals",
          tags: ["Portals"],
          summary: "Read normalized portal config",
          description:
            "Reads the first supported fixed Portal Config file from the configured Career Ops Workspace and returns normalized MVP portal fields.",
          security: [{ LocalPairingToken: [] }],
          responses: {
            "200": jsonResponse("Current normalized Portal Config.", "PortalDto", {
              current: { $ref: "#/components/examples/PortalValid" }
            }),
            "400": jsonResponse("Portal Config is malformed or cannot be normalized.", "ErrorResponseDto", {
              validation: { $ref: "#/components/examples/ValidationError" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": jsonResponse("Portal Config path is outside the workspace.", "ErrorResponseDto", {
              outsideWorkspace: { $ref: "#/components/examples/PathOutsideWorkspaceError" }
            }),
            "404": jsonResponse("Portal Config file is missing.", "ErrorResponseDto", {
              missing: { $ref: "#/components/examples/PortalMissingError" }
            }),
            "503": jsonResponse("Career Ops Workspace is not ready.", "ErrorResponseDto", {
              workspace: { $ref: "#/components/examples/WorkspaceUnhealthyError" }
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
        CvDto: schemaFromZod(CvDtoSchema),
        ProfileDto: schemaFromZod(ProfileDtoSchema),
        PortalDto: schemaFromZod(PortalDtoSchema),
        SaveCvRequestDto: schemaFromZod(SaveCvRequestDtoSchema),
        SaveProfileRequestDto: schemaFromZod(SaveProfileRequestDtoSchema),
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
        CvValid: {
          summary: "Current or saved CV Markdown",
          value: examples.cvValid
        },
        ProfileValid: {
          summary: "Current normalized Profile Config",
          value: examples.profileValid
        },
        PortalValid: {
          summary: "Current normalized Portal Config",
          value: examples.portalValid
        },
        ValidationError: {
          summary: "Validation error response",
          value: examples.validationError
        },
        UnauthorizedError: {
          summary: "Missing or invalid Local Pairing Token",
          value: examples.unauthorizedError
        },
        PathOutsideWorkspaceError: {
          summary: "Requested path is outside the configured Career Ops Workspace",
          value: examples.pathOutsideWorkspaceError
        },
        WorkspaceUnhealthyError: {
          summary: "Career Ops Workspace is not ready",
          value: examples.workspaceUnhealthyError
        },
        CvMissingError: {
          summary: "CV Markdown file is missing",
          value: examples.cvMissingError
        },
        ProfileMissingError: {
          summary: "Profile Config file is missing",
          value: examples.profileMissingError
        },
        PortalMissingError: {
          summary: "Portal Config file is missing",
          value: examples.portalMissingError
        },
        PayloadTooLargeError: {
          summary: "CV Markdown payload is too large",
          value: examples.payloadTooLargeError
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

function jsonRequestBody(
  schemaName: string,
  examplesByName?: Record<string, OpenApiExample>
): OpenApiJsonRequestBody {
  return {
    required: true,
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

function profileSaveRequestExample(): unknown {
  const { sourceRevision: _sourceRevision, updatedAt: _updatedAt, ...request } = examples.profileValid;
  return SaveProfileRequestDtoSchema.parse(request);
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
