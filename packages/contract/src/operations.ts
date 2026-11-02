import type { z } from "zod";
import { CvDtoSchema, CvImportDtoSchema, CvUpdateRequestSchema, CV_UPLOAD_MAX_BYTES } from "./cv.js";
import { DeviceUpdateRequestSchema } from "./devices.js";
import { ErrorResponseDtoSchema } from "./errors.js";
import { EntitlementDtoSchema, PurchaseRequestSchema } from "./billing.js";
import { EvaluationDtoSchema } from "./evaluations.js";
import { FeedPageDtoSchema } from "./feed.js";
import { HealthDtoSchema, MeDtoSchema } from "./identity.js";
import { CompanyCreateRequestSchema, CompanyDtoSchema, JobDtoSchema } from "./jobs.js";
import { PreferencesDtoSchema } from "./preferences.js";
import { TrackerEntryDtoSchema, TrackerPageDtoSchema, TrackerUpdateRequestSchema } from "./tracker.js";

export interface ResponseSpec {
  readonly description: string;
  /** Null for a response with no body. */
  readonly schema: z.ZodType | null;
  /** Names under `contracts/examples/`, without `.json`. */
  readonly examples: readonly string[];
}

export interface HeaderParam {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export interface QueryParam {
  readonly name: string;
  readonly description: string;
  readonly schema: Readonly<Record<string, unknown>>;
}

export type RequestSpec =
  | { readonly kind: "json"; readonly schema: z.ZodType; readonly example: string }
  | { readonly kind: "cv-upload" };

export interface Operation {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly public: boolean;
  /** The phase of the hosted design that ships it. */
  readonly phase: 1 | 2 | 3;
  readonly pathParams?: readonly string[];
  readonly headers?: readonly HeaderParam[];
  readonly query?: readonly QueryParam[];
  readonly request?: RequestSpec;
  readonly responses: Readonly<Record<number, ResponseSpec>>;
}

const body = (description: string, schema: z.ZodType, ...examples: string[]): ResponseSpec => ({ description, schema, examples });
const empty = (description: string): ResponseSpec => ({ description, schema: null, examples: [] });
const error = (description: string, ...examples: string[]): ResponseSpec => ({ description, schema: ErrorResponseDtoSchema, examples });

const badRequest = error("The request is not valid.", "errors/validation-error");
const notFound = error("Not found, or not this user's.", "errors/not-found");

/** Every authenticated route can answer these. */
const authenticatedErrors = {
  401: error("The token is missing or not valid. The app signs in again.", "errors/unauthorized"),
  429: error("Too many requests.", "errors/rate-limited"),
  500: error("An unexpected error.", "errors/unexpected-error"),
  503: error("A dependency is down. This is not a sign-in problem; the app retries and keeps the user signed in.", "errors/auth-unavailable", "errors/unavailable")
} as const;

const paging: readonly QueryParam[] = [
  { name: "cursor", description: "`nextCursor` from the previous page.", schema: { type: "string", minLength: 1, maxLength: 200 } },
  { name: "limit", description: "Page size.", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }
];

const integrity = (required: boolean, when: string): HeaderParam => ({
  name: "X-Integrity-Token",
  required,
  description: `Play Integrity token. ${when}`
});

const aiRefused = error(
  "Refused before any AI call: not signed in with Google, no entitlement or trial left, or a failed integrity check.",
  "errors/sign-in-required",
  "errors/entitlement-required",
  "errors/integrity-failed"
);

function authed(operation: Omit<Operation, "public" | "responses"> & { readonly responses: Operation["responses"] }): Operation {
  const own429 = operation.responses[429];
  const responses: Record<number, ResponseSpec> = { ...operation.responses, ...authenticatedErrors };
  // An operation's own 429 keeps its extra examples next to the shared one.
  if (own429) responses[429] = { ...own429, examples: [...own429.examples, ...authenticatedErrors[429].examples] };
  return { ...operation, public: false, responses };
}

export const operations: readonly Operation[] = [
  {
    method: "GET",
    path: "/api/v1/health",
    operationId: "getHealth",
    summary: "Whether the service can answer.",
    public: true,
    phase: 1,
    responses: {
      200: body("The service is healthy.", HealthDtoSchema, "health.ok"),
      503: body("A dependency is down.", HealthDtoSchema, "health.degraded")
    }
  },
  authed({
    method: "GET",
    path: "/api/v1/me",
    operationId: "getMe",
    summary: "The signed-in user. Creates the user on the first call.",
    phase: 1,
    responses: { 200: body("The user.", MeDtoSchema, "me.valid") }
  }),
  authed({
    method: "DELETE",
    path: "/api/v1/me",
    operationId: "deleteMe",
    summary: "Delete the account and all of the user's data.",
    phase: 3,
    responses: { 202: empty("Deletion has started.") }
  }),
  authed({
    method: "GET",
    path: "/api/v1/me/preferences",
    operationId: "getPreferences",
    summary: "What the user wants. A new user gets every list empty.",
    phase: 2,
    responses: { 200: body("The preferences.", PreferencesDtoSchema, "preferences.valid", "preferences.empty") }
  }),
  authed({
    method: "PUT",
    path: "/api/v1/me/preferences",
    operationId: "putPreferences",
    summary: "Replace the preferences.",
    phase: 2,
    request: { kind: "json", schema: PreferencesDtoSchema, example: "requests/preferences-update" },
    responses: { 200: body("The stored preferences.", PreferencesDtoSchema, "preferences.valid"), 400: badRequest }
  }),
  authed({
    method: "POST",
    path: "/api/v1/me/cv/import",
    operationId: "importCv",
    summary: `Extract a CV file (PDF or DOCX, at most ${CV_UPLOAD_MAX_BYTES / (1024 * 1024)} MiB) as Markdown for review. Nothing is stored until PUT /me/cv.`,
    phase: 2,
    headers: [integrity(false, "Optional in this draft. Phase 3, which ships Play Integrity, makes it required.")],
    request: { kind: "cv-upload" },
    responses: {
      200: body("The extracted text.", CvImportDtoSchema, "cv-import.valid"),
      400: badRequest,
      403: aiRefused,
      413: error("The file is too large.", "errors/payload-too-large"),
      415: error("Not a PDF or DOCX file.", "errors/unsupported-media-type"),
      422: error("No text could be read, for example a scanned image.", "errors/cv-unreadable")
    }
  }),
  authed({
    method: "GET",
    path: "/api/v1/me/cv",
    operationId: "getCv",
    summary: "The stored CV.",
    phase: 2,
    responses: { 200: body("The CV.", CvDtoSchema, "cv.valid"), 404: error("No CV yet.", "errors/not-found") }
  }),
  authed({
    method: "PUT",
    path: "/api/v1/me/cv",
    operationId: "putCv",
    summary: "Store the reviewed CV.",
    phase: 2,
    request: { kind: "json", schema: CvUpdateRequestSchema, example: "requests/cv-update" },
    responses: {
      200: body("The stored CV.", CvDtoSchema, "cv.valid"),
      400: badRequest,
      409: error("That import has expired or was already used.", "errors/conflict")
    }
  }),
  authed({
    method: "GET",
    path: "/api/v1/feed",
    operationId: "getFeed",
    summary: "Jobs that match the user, newest and best first, and why.",
    phase: 2,
    query: paging,
    responses: { 200: body("One page of matches.", FeedPageDtoSchema, "feed.valid", "feed.empty"), 400: badRequest }
  }),
  authed({
    method: "GET",
    path: "/api/v1/jobs/{jobId}",
    operationId: "getJob",
    summary: "One job.",
    phase: 2,
    pathParams: ["jobId"],
    responses: { 200: body("The job.", JobDtoSchema, "job.valid", "job.closed"), 404: notFound }
  }),
  authed({
    method: "PUT",
    path: "/api/v1/jobs/{jobId}/tracker",
    operationId: "putTracker",
    summary: "Mark a job. The app never applies for the user.",
    phase: 2,
    pathParams: ["jobId"],
    request: { kind: "json", schema: TrackerUpdateRequestSchema, example: "requests/tracker-update" },
    responses: { 200: body("The stored mark.", TrackerEntryDtoSchema, "tracker-entry.valid"), 400: badRequest, 404: notFound }
  }),
  authed({
    method: "DELETE",
    path: "/api/v1/jobs/{jobId}/tracker",
    operationId: "deleteTracker",
    summary: "Remove the mark from a job.",
    phase: 2,
    pathParams: ["jobId"],
    responses: { 204: empty("Removed, or was not marked."), 404: notFound }
  }),
  authed({
    method: "GET",
    path: "/api/v1/tracker",
    operationId: "getTracker",
    summary: "The jobs the user has marked, most recently changed first.",
    phase: 2,
    query: paging,
    responses: { 200: body("One page of marked jobs.", TrackerPageDtoSchema, "tracker.valid"), 400: badRequest }
  }),
  authed({
    method: "POST",
    path: "/api/v1/companies",
    operationId: "addCompany",
    summary: "Add a company careers page to the shared job index.",
    phase: 2,
    request: { kind: "json", schema: CompanyCreateRequestSchema, example: "requests/company-create" },
    responses: { 200: body("The company.", CompanyDtoSchema, "company.valid"), 400: badRequest }
  }),
  authed({
    method: "PUT",
    path: "/api/v1/me/devices/{installationId}",
    operationId: "putDevice",
    summary: "Register this installation's FCM token.",
    phase: 2,
    pathParams: ["installationId"],
    request: { kind: "json", schema: DeviceUpdateRequestSchema, example: "requests/device-update" },
    responses: { 204: empty("Registered."), 400: badRequest, 404: notFound }
  }),
  authed({
    method: "DELETE",
    path: "/api/v1/me/devices/{installationId}",
    operationId: "deleteDevice",
    summary: "Stop sending push to this installation.",
    phase: 2,
    pathParams: ["installationId"],
    responses: { 204: empty("Removed, or was not registered."), 404: notFound }
  }),
  authed({
    method: "POST",
    path: "/api/v1/jobs/{jobId}/evaluations",
    operationId: "startEvaluation",
    summary: "Start an AI evaluation of one job against the user's CV.",
    phase: 3,
    pathParams: ["jobId"],
    headers: [integrity(true, "Required: this request costs money.")],
    responses: {
      202: body("Queued. Progress also arrives by push.", EvaluationDtoSchema, "evaluation.queued"),
      403: aiRefused,
      404: notFound,
      429: error("The plan's quota is used up.", "errors/quota-exceeded")
    }
  }),
  authed({
    method: "GET",
    path: "/api/v1/evaluations/{evaluationId}",
    operationId: "getEvaluation",
    summary: "One evaluation: its stage, and its result when done.",
    phase: 3,
    pathParams: ["evaluationId"],
    responses: {
      200: body("The evaluation.", EvaluationDtoSchema, "evaluation.queued", "evaluation.analyzing", "evaluation.done", "evaluation.failed"),
      404: notFound
    }
  }),
  authed({
    method: "GET",
    path: "/api/v1/me/entitlement",
    operationId: "getEntitlement",
    summary: "The user's plan, features and quota counters.",
    phase: 3,
    responses: { 200: body("The entitlement.", EntitlementDtoSchema, "entitlement.free", "entitlement.paid") }
  }),
  authed({
    method: "POST",
    path: "/api/v1/me/purchases",
    operationId: "recordPurchase",
    summary: "Verify a Google Play purchase with Google and store the entitlement.",
    phase: 3,
    request: { kind: "json", schema: PurchaseRequestSchema, example: "requests/purchase-create" },
    responses: {
      200: body("The updated entitlement.", EntitlementDtoSchema, "entitlement.paid"),
      400: badRequest,
      409: error("That purchase belongs to another account.", "errors/conflict")
    }
  })
];
