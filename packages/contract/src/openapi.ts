import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { contractRegistry } from "./common.js";
import { CV_UPLOAD_MAX_BYTES } from "./cv.js";
import { operations, type Operation, type ResponseSpec } from "./operations.js";

const COMPONENT_PREFIX = "#/components/schemas/";

export function loadExample(examplesDir: string, name: string): unknown {
  return JSON.parse(readFileSync(path.join(examplesDir, `${name}.json`), "utf8"));
}

/** `Prefer: example=` cannot carry a slash, so `errors/not-found` is served as `errors.not-found`. */
export function exampleKey(name: string): string {
  return name.replaceAll("/", ".");
}

// The generated document is plain JSON, so its shape is not worth a type of its own.
export type OpenApiDocument = any;

export function buildOpenApiDocument(examplesDir: string): OpenApiDocument {
  const { schemas } = z.toJSONSchema(contractRegistry, {
    target: "draft-2020-12",
    uri: (id) => `${COMPONENT_PREFIX}${id}`,
    reused: "inline"
  });
  // Sorted because the registry's order depends on which module was imported first.
  const components = Object.fromEntries(
    Object.entries(schemas)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, schema]) => {
        const { $schema: _schema, $id: _id, ...rest } = schema as Record<string, unknown>;
        return [id, rest];
      })
  );

  const reference = (schema: z.ZodType) => {
    const id = contractRegistry.get(schema)?.id;
    if (!id) throw new Error("Every schema an operation uses must be named.");
    return { $ref: `${COMPONENT_PREFIX}${id}` };
  };

  const responseEntry = (spec: ResponseSpec) => {
    if (spec.schema === null) return { description: spec.description };
    return {
      description: spec.description,
      content: {
        "application/json": {
          schema: reference(spec.schema),
          examples: Object.fromEntries(spec.examples.map((name) => [exampleKey(name), { value: loadExample(examplesDir, name) }]))
        }
      }
    };
  };

  const requestBody = (operation: Operation) => {
    const { request } = operation;
    if (!request) return {};
    if (request.kind === "cv-upload") {
      return {
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary", description: `PDF or DOCX, at most ${CV_UPLOAD_MAX_BYTES} bytes.` },
                  restructure: {
                    type: "boolean",
                    default: false,
                    description: "Ask AI to restructure the text. Needs Google sign-in, and an entitlement or the trial. Without it, the server extracts plain text."
                  }
                }
              }
            }
          }
        }
      };
    }
    return {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: reference(request.schema),
            examples: { [exampleKey(request.example)]: { value: loadExample(examplesDir, request.example) } }
          }
        }
      }
    };
  };

  const operationEntry = (operation: Operation) => {
    const parameters = [
      ...(operation.pathParams ?? []).map((name) => ({ name, in: "path", required: true, schema: { type: "string", minLength: 1, maxLength: 200 } })),
      ...(operation.query ?? []).map(({ name, description, schema }) => ({ name, in: "query", required: false, description, schema })),
      ...(operation.headers ?? []).map(({ name, required, description }) => ({
        name,
        in: "header",
        required,
        description,
        schema: { type: "string", minLength: 1 }
      }))
    ];
    return {
      operationId: operation.operationId,
      summary: operation.summary,
      "x-phase": operation.phase,
      security: operation.public ? [] : [{ bearerAuth: [] }],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...requestBody(operation),
      responses: Object.fromEntries(Object.entries(operation.responses).map(([status, spec]) => [status, responseEntry(spec)]))
    };
  };

  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    paths[operation.path] = { ...paths[operation.path], [operation.method.toLowerCase()]: operationEntry(operation) };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "JobFlow API",
      version: "0.1.0-draft",
      description: "The hosted JobFlow API. Generated from packages/contract; do not edit by hand."
    },
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: components
    }
  };
}

export function serializeOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
