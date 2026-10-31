import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ArtifactCollectionDtoSchema,
  CvDtoSchema,
  ErrorResponseDtoSchema,
  HealthDtoSchema,
  OfferCollectionDtoSchema,
  OfferDtoSchema,
  PortalDtoSchema,
  ProfileDtoSchema,
  ReportCollectionDtoSchema,
  ReportDetailDtoSchema,
  SaveCvRequestDtoSchema,
  SavePortalRequestDtoSchema,
  SaveProfileRequestDtoSchema,
  ScanReadinessDtoSchema,
  ScanRunDtoSchema,
  StartScanRunRequestDtoSchema
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
  readonly paths: Readonly<Record<string, OpenApiPathItem>>;
  readonly components: {
    readonly schemas: Readonly<Record<string, JsonSchemaObject>>;
    readonly examples: Readonly<Record<string, OpenApiExample>>;
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

type OpenApiPathItem = Partial<Record<"get" | "put" | "post", OpenApiOperation>>;

interface OpenApiOperation {
  readonly operationId: string;
  readonly tags: readonly string[];
  readonly summary: string;
  readonly description: string;
  readonly security: readonly OpenApiSecurityRequirement[];
  readonly parameters?: readonly OpenApiParameter[];
  readonly requestBody?: OpenApiJsonRequestBody;
  readonly responses: Readonly<Record<string, OpenApiResponse>>;
}

interface OpenApiParameter {
  readonly name: string;
  readonly in: "path";
  readonly required: true;
  readonly description: string;
  readonly schema: { readonly type: "string"; readonly pattern: string };
}

type OpenApiResponse = OpenApiJsonResponse | OpenApiBinaryResponse;

interface OpenApiBinaryResponse {
  readonly description: string;
  readonly headers?: Readonly<Record<string, { readonly description: string; readonly schema: { readonly type: "string" } }>>;
  readonly content: Readonly<Record<string, { readonly schema: { readonly type: "string"; readonly format: "binary" } }>>;
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
  scanReadinessReady: ScanReadinessDtoSchema.parse(
    readJsonExample("contracts/examples/scan-readiness.ready.json")
  ),
  scanReadinessNotReady: ScanReadinessDtoSchema.parse(
    readJsonExample("contracts/examples/scan-readiness.not-ready.json")
  ),
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
  scanRunRunning: ScanRunDtoSchema.parse(readJsonExample("contracts/examples/scan-run.running.json")),
  scanRunSucceeded: ScanRunDtoSchema.parse(readJsonExample("contracts/examples/scan-run.succeeded.json")),
  scanRunFailed: ScanRunDtoSchema.parse(readJsonExample("contracts/examples/scan-run.failed.json")),
  offersCollection: OfferCollectionDtoSchema.parse(readJsonExample("contracts/examples/offers.collection.json")),
  offerValid: OfferDtoSchema.parse(readJsonExample("contracts/examples/offer.valid.json")),
  offerNotEvaluated: OfferDtoSchema.parse(readJsonExample("contracts/examples/offer.not-evaluated.json")),
  reportsCollection: ReportCollectionDtoSchema.parse(readJsonExample("contracts/examples/reports.collection.json")),
  reportDetail: ReportDetailDtoSchema.parse(readJsonExample("contracts/examples/report.detail.valid.json")),
  artifactsCollection: ArtifactCollectionDtoSchema.parse(
    readJsonExample("contracts/examples/artifacts.collection.json")
  ),
  scanAlreadyRunningError: ErrorResponseDtoSchema.parse(
    readJsonExample("contracts/examples/errors/scan-already-running.json")
  ),
  scanNotReadyError: ErrorResponseDtoSchema.parse(readJsonExample("contracts/examples/errors/scan-not-ready.json")),
  notFoundError: ErrorResponseDtoSchema.parse(readJsonExample("contracts/examples/errors/not-found.json")),
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
        "Local-first wrapper API for Career Ops Mobile. The documented surface covers setup/readiness, career inputs, scan runs, and read-only offer, report, and artifact projections. /docs and /openapi.json are public setup/developer endpoints and do not require the Local Pairing Token."
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
        description: "Read and safely save normalized MVP fields for the fixed Career Ops Portal Config"
      },
      {
        name: "Scan Readiness",
        description: "Compute read-only scan gating readiness from workspace inputs"
      },
      {
        name: "Scan Runs",
        description: "Start the local Career Ops scan.mjs with allowlisted options and poll its status"
      },
      {
        name: "Offers",
        description: "Read-only offer projection merged from scan history, pipeline, and tracker"
      },
      {
        name: "Reports",
        description: "Read-only Career Ops evaluation reports"
      },
      {
        name: "Artifacts",
        description: "Read-only generated PDFs from the workspace output folder"
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
            "400": errorResponse("CV Markdown file is blank.", "validation", "ValidationError"),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": errorResponse("CV Markdown path is outside the workspace.", "outsideWorkspace", "PathOutsideWorkspaceError"),
            "404": jsonResponse("CV Markdown file is missing.", "ErrorResponseDto", {
              missing: { $ref: "#/components/examples/CvMissingError" }
            }),
            "413": errorResponse("CV Markdown file is over 512 KiB.", "tooLarge", "PayloadTooLargeError"),
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
            "403": errorResponse("CV Markdown path is outside the workspace.", "outsideWorkspace", "PathOutsideWorkspaceError"),
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
        },
        put: {
          operationId: "savePortals",
          tags: ["Portals"],
          summary: "Save normalized portal config",
          description:
            "Validates editable MVP Portal Config fields and safely writes the fixed Portal Config file inside the configured Career Ops Workspace.",
          security: [{ LocalPairingToken: [] }],
          requestBody: jsonRequestBody("SavePortalRequestDto", {
            portals: {
              summary: "Editable MVP Portal Config fields",
              value: portalSaveRequestExample()
            }
          }),
          responses: {
            "200": jsonResponse("Saved normalized Portal Config.", "PortalDto", {
              saved: { $ref: "#/components/examples/PortalValid" }
            }),
            "400": jsonResponse("Invalid Portal Config request.", "ErrorResponseDto", {
              validation: { $ref: "#/components/examples/ValidationError" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": jsonResponse("Portal Config path is outside the workspace.", "ErrorResponseDto", {
              outsideWorkspace: { $ref: "#/components/examples/PathOutsideWorkspaceError" }
            }),
            "413": jsonResponse("Portal Config payload is too large.", "ErrorResponseDto", {
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
      "/api/v1/scan-readiness": {
        get: {
          operationId: "getScanReadiness",
          tags: ["Scan Readiness"],
          summary: "Compute scan readiness",
          description:
            "Computes a read-only checklist for wrapper, workspace, local scanner, CV, Profile Config, and Portal Config readiness. It does not start scan execution.",
          security: [{ LocalPairingToken: [] }],
          responses: {
            "200": jsonResponse("Current scan readiness checklist.", "ScanReadinessDto", {
              ready: { $ref: "#/components/examples/ScanReadinessReady" },
              notReady: { $ref: "#/components/examples/ScanReadinessNotReady" }
            }),
            "401": jsonResponse("Missing or invalid Local Pairing Token.", "ErrorResponseDto", {
              unauthorized: { $ref: "#/components/examples/UnauthorizedError" }
            }),
            "403": jsonResponse("Input path is outside the workspace.", "ErrorResponseDto", {
              outsideWorkspace: { $ref: "#/components/examples/PathOutsideWorkspaceError" }
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
      "/api/v1/scan-runs": {
        post: {
          operationId: "startScanRun",
          tags: ["Scan Runs"],
          summary: "Start a scan run",
          description:
            "Starts the workspace scan.mjs in the background with only the allowlisted dryRun and company options. Only one scan runs at a time. The scan finds job links; it does not run AI evaluation.",
          security: protectedSecurity,
          requestBody: jsonRequestBody("StartScanRunRequestDto", {
            all: { summary: "Scan every tracked company", value: { dryRun: false } },
            company: { summary: "Dry run for one company", value: { dryRun: true, company: "Acme Robotics" } }
          }),
          responses: {
            "202": jsonResponse("Scan run accepted and running.", "ScanRunDto", {
              running: exampleRef("ScanRunRunning")
            }),
            "400": errorResponse("Invalid scan request.", "validation", "ValidationError"),
            "401": unauthorizedResponse(),
            "409": errorResponse("A scan is already running.", "alreadyRunning", "ScanAlreadyRunningError"),
            "413": errorResponse("Request body is too large.", "tooLarge", "PayloadTooLargeError"),
            "503": errorResponse("Scan readiness is not ready.", "notReady", "ScanNotReadyError"),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/scan-runs/latest": {
        get: {
          operationId: "getLatestScanRun",
          tags: ["Scan Runs"],
          summary: "Get the latest scan run",
          description: "Returns the most recent scan run since the wrapper started. Runs are kept in memory only.",
          security: protectedSecurity,
          responses: {
            "200": scanRunResponse(),
            "401": unauthorizedResponse(),
            "404": notFoundResponse("No scan run since wrapper startup."),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/scan-runs/{id}": {
        get: {
          operationId: "getScanRun",
          tags: ["Scan Runs"],
          summary: "Get scan run status",
          description: "Returns one scan run for polling.",
          security: protectedSecurity,
          parameters: [idParameter("Scan run ID.", "^scan_\\d{14}_[a-f0-9]{6}$")],
          responses: {
            "200": scanRunResponse(),
            "401": unauthorizedResponse(),
            "404": notFoundResponse("Scan run was not found."),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/offers": {
        get: {
          operationId: "listOffers",
          tags: ["Offers"],
          summary: "List offers",
          description:
            "Merges data/scan-history.tsv, data/pipeline.md, data/applications.md, and report headers by URL. Scores map x/5 to 0-100. Offers without a score or report are notEvaluated.",
          security: protectedSecurity,
          responses: {
            "200": jsonResponse("Offer projection.", "OfferCollectionDto", {
              offers: exampleRef("OffersCollection")
            }),
            "401": unauthorizedResponse(),
            "403": errorResponse("A source file resolves outside the workspace.", "outsideWorkspace", "PathOutsideWorkspaceError"),
            "413": errorResponse("A source file is too large.", "tooLarge", "PayloadTooLargeError"),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/offers/{id}": {
        get: {
          operationId: "getOffer",
          tags: ["Offers"],
          summary: "Get one offer",
          description: "Returns one projected offer by opaque ID.",
          security: protectedSecurity,
          parameters: [idParameter("Offer ID.", "^offer_[a-f0-9]{16}$")],
          responses: {
            "200": jsonResponse("One projected offer.", "OfferDto", {
              evaluated: exampleRef("OfferValid"),
              notEvaluated: exampleRef("OfferNotEvaluated")
            }),
            "401": unauthorizedResponse(),
            "403": errorResponse("A source file resolves outside the workspace.", "outsideWorkspace", "PathOutsideWorkspaceError"),
            "404": notFoundResponse("Offer was not found."),
            "413": errorResponse("A source file is too large.", "tooLarge", "PayloadTooLargeError"),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/reports": {
        get: {
          operationId: "listReports",
          tags: ["Reports"],
          summary: "List reports",
          description: "Lists numbered evaluation reports in reports/, newest first.",
          security: protectedSecurity,
          responses: {
            "200": jsonResponse("Report list.", "ReportCollectionDto", {
              reports: exampleRef("ReportsCollection")
            }),
            "401": unauthorizedResponse(),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/reports/{id}": {
        get: {
          operationId: "getReport",
          tags: ["Reports"],
          summary: "Get one report",
          description: "Returns report Markdown with workspace and home paths redacted.",
          security: protectedSecurity,
          parameters: [idParameter("Report ID.", "^report_\\d{3,6}$")],
          responses: {
            "200": jsonResponse("Report detail.", "ReportDetailDto", {
              report: exampleRef("ReportDetail")
            }),
            "401": unauthorizedResponse(),
            "404": notFoundResponse("Report was not found."),
            "413": errorResponse("Report Markdown is over 1 MiB.", "tooLarge", "PayloadTooLargeError"),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/artifacts": {
        get: {
          operationId: "listArtifacts",
          tags: ["Artifacts"],
          summary: "List artifacts",
          description: "Lists regular PDF files directly inside output/. Symbolic links are skipped.",
          security: protectedSecurity,
          responses: {
            "200": jsonResponse("Artifact list.", "ArtifactCollectionDto", {
              artifacts: exampleRef("ArtifactsCollection")
            }),
            "401": unauthorizedResponse(),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
          }
        }
      },
      "/api/v1/artifacts/{id}/download": {
        get: {
          operationId: "downloadArtifact",
          tags: ["Artifacts"],
          summary: "Download one artifact",
          description: "Streams one listed PDF as an attachment.",
          security: protectedSecurity,
          parameters: [idParameter("Artifact ID.", "^artifact_[a-f0-9]{16}$")],
          responses: {
            "200": {
              description: "PDF bytes.",
              headers: {
                "Content-Disposition": { description: "attachment; filename=...", schema: { type: "string" } }
              },
              content: { "application/pdf": { schema: { type: "string", format: "binary" } } }
            },
            "401": unauthorizedResponse(),
            "404": notFoundResponse("Artifact was not found."),
            "503": workspaceResponse(),
            "500": unexpectedResponse()
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
        ScanReadinessDto: schemaFromZod(ScanReadinessDtoSchema),
        SaveCvRequestDto: schemaFromZod(SaveCvRequestDtoSchema),
        SavePortalRequestDto: schemaFromZod(SavePortalRequestDtoSchema),
        SaveProfileRequestDto: schemaFromZod(SaveProfileRequestDtoSchema),
        StartScanRunRequestDto: schemaFromZod(StartScanRunRequestDtoSchema),
        ScanRunDto: schemaFromZod(ScanRunDtoSchema),
        OfferDto: schemaFromZod(OfferDtoSchema),
        OfferCollectionDto: schemaFromZod(OfferCollectionDtoSchema),
        ReportCollectionDto: schemaFromZod(ReportCollectionDtoSchema),
        ReportDetailDto: schemaFromZod(ReportDetailDtoSchema),
        ArtifactCollectionDto: schemaFromZod(ArtifactCollectionDtoSchema),
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
        ScanReadinessReady: {
          summary: "All scan readiness checks are ready",
          value: examples.scanReadinessReady
        },
        ScanReadinessNotReady: {
          summary: "One or more scan readiness checks are not ready",
          value: examples.scanReadinessNotReady
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
          summary: "Request payload is too large",
          value: examples.payloadTooLargeError
        },
        ScanRunRunning: { summary: "Scan run in progress", value: examples.scanRunRunning },
        ScanRunSucceeded: { summary: "Completed scan run", value: examples.scanRunSucceeded },
        ScanRunFailed: { summary: "Failed scan run", value: examples.scanRunFailed },
        OffersCollection: { summary: "Offer projection", value: examples.offersCollection },
        OfferValid: { summary: "Evaluated offer", value: examples.offerValid },
        OfferNotEvaluated: { summary: "Offer found by a scan, not evaluated yet", value: examples.offerNotEvaluated },
        ReportsCollection: { summary: "Report list", value: examples.reportsCollection },
        ReportDetail: { summary: "Evaluation report", value: examples.reportDetail },
        ArtifactsCollection: { summary: "Generated PDFs", value: examples.artifactsCollection },
        ScanAlreadyRunningError: { summary: "A scan is already running", value: examples.scanAlreadyRunningError },
        ScanNotReadyError: { summary: "Scan readiness is not ready", value: examples.scanNotReadyError },
        NotFoundError: { summary: "Resource was not found", value: examples.notFoundError },
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

const protectedSecurity: readonly OpenApiSecurityRequirement[] = [{ LocalPairingToken: [] }];

function exampleRef(name: string): { readonly $ref: string } {
  return { $ref: `#/components/examples/${name}` };
}

function errorResponse(description: string, key: string, exampleName: string): OpenApiJsonResponse {
  return jsonResponse(description, "ErrorResponseDto", { [key]: exampleRef(exampleName) });
}

function unauthorizedResponse(): OpenApiJsonResponse {
  return errorResponse("Missing or invalid Local Pairing Token.", "unauthorized", "UnauthorizedError");
}

function workspaceResponse(): OpenApiJsonResponse {
  return errorResponse("Career Ops Workspace is not ready.", "workspace", "WorkspaceUnhealthyError");
}

function notFoundResponse(description: string): OpenApiJsonResponse {
  return errorResponse(description, "notFound", "NotFoundError");
}

function unexpectedResponse(): OpenApiJsonResponse {
  return errorResponse("Unexpected wrapper error response.", "unexpected", "UnexpectedError");
}

function scanRunResponse(): OpenApiJsonResponse {
  return jsonResponse("Scan run status.", "ScanRunDto", {
    running: exampleRef("ScanRunRunning"),
    succeeded: exampleRef("ScanRunSucceeded"),
    failed: exampleRef("ScanRunFailed")
  });
}

function idParameter(description: string, pattern: string): OpenApiParameter {
  return { name: "id", in: "path", required: true, description, schema: { type: "string", pattern } };
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

function portalSaveRequestExample(): unknown {
  const { sourceRevision: _sourceRevision, updatedAt: _updatedAt, ...request } = examples.portalValid;
  return SavePortalRequestDtoSchema.parse(request);
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
