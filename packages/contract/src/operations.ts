import type { z } from "zod";
import { OPAQUE_ID_PATTERN } from "./common.js";
import { CV_IMPORT_RETENTION_HOURS, CV_UPLOAD_MAX_BYTES, CvDtoSchema, CvImportDtoSchema, CvUpdateRequestSchema } from "./cv.js";
import { DEVICE_MAX_PER_USER, DeviceUpdateRequestSchema } from "./devices.js";
import { ErrorResponseDtoSchema } from "./errors.js";
import { EntitlementDtoSchema, PurchaseRequestSchema } from "./billing.js";
import { EvaluationDtoSchema } from "./evaluations.js";
import { FeedPageDtoSchema } from "./feed.js";
import {
  GuestResponseDtoSchema,
  HealthDtoSchema,
  LogoutRequestSchema,
  MeDtoSchema,
  RefreshRequestSchema,
  SessionTokensDtoSchema,
  SsoRequestSchema,
  SsoResponseDtoSchema
} from "./identity.js";
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
  401: error(
    "The access token is missing, expired or not accepted. Refresh once and retry once; sign in again only if POST /auth/refresh answers 401.",
    "errors/unauthorized"
  ),
  429: error("Too many requests.", "errors/rate-limited"),
  500: error("An unexpected error.", "errors/unexpected-error"),
  503: error("A dependency is down. This is not a sign-in problem; the app retries and keeps the user signed in.", "errors/auth-unavailable", "errors/unavailable")
} as const;

const paging: readonly QueryParam[] = [
  { name: "cursor", description: "`nextCursor` from the previous page.", schema: { type: "string", pattern: OPAQUE_ID_PATTERN } },
  { name: "limit", description: "Page size.", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }
];

const integrity = (required: boolean, when: string): HeaderParam => ({
  name: "X-Integrity-Token",
  required,
  description: `Play Integrity token. ${when}`
});

/** A public route has no session to keep, so a 503 here only means retry. */
const publicServerErrors = {
  500: error("An unexpected error.", "errors/unexpected-error"),
  503: error("The database is down. Retry.", "errors/unavailable")
} as const;

const quotaUsedUp = error("The plan's quota is used up.", "errors/quota-exceeded");

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
      429: error("Too many requests from this address.", "errors/rate-limited"),
      503: body("A dependency is down.", HealthDtoSchema, "health.degraded")
    }
  },
  {
    method: "POST",
    path: "/api/v1/auth/guest",
    operationId: "signInGuest",
    summary:
      "Create a guest and its session. Public, with its own limit per address. Each call makes a new guest: call it once per install and keep the pair.",
    public: true,
    phase: 1,
    responses: {
      200: body("The new guest's tokens and account.", GuestResponseDtoSchema, "auth-guest.valid"),
      429: error("Too many guests or requests from this address.", "errors/rate-limited"),
      ...publicServerErrors
    }
  },
  {
    method: "POST",
    path: "/api/v1/auth/sso",
    operationId: "signInSso",
    summary:
      "Sign in with the identity provider's ID token and start a session; the app then signs out of the provider. Finds or creates the member. With guestRefreshToken, moves that guest's data to this account and revokes the guest's session. Public. Safe to retry, also after a merge whose answer was lost.",
    public: true,
    phase: 1,
    request: { kind: "json", schema: SsoRequestSchema, example: "requests/auth-sso" },
    responses: {
      200: body(
        "Signed in. guestMerged is false when no guest's data moved: no guestRefreshToken, one that is unknown, revoked or a member's, or a guest already merged elsewhere or deleted.",
        SsoResponseDtoSchema,
        "auth-sso.merged",
        "auth-sso.not-merged"
      ),
      400: badRequest,
      401: error("The ID token is not valid, or its account was deleted. Nothing changed: the app is still the guest it was.", "errors/unauthorized"),
      403: error("The ID token is anonymous.", "errors/sign-in-required"),
      429: error("Too many requests from this address.", "errors/rate-limited"),
      500: error("An unexpected error.", "errors/unexpected-error"),
      503: error(
        "The ID token or the database could not be checked. Nothing is lost: retry with the same body.",
        "errors/auth-unavailable",
        "errors/unavailable"
      )
    }
  },
  {
    method: "POST",
    path: "/api/v1/auth/refresh",
    operationId: "refreshSession",
    summary:
      "Get a new access token. The refresh token is not rotated: the answer gives the same one back, and it works until logout, merge or account deletion. Safe to retry. Public.",
    public: true,
    phase: 1,
    request: { kind: "json", schema: RefreshRequestSchema, example: "requests/auth-refresh" },
    responses: {
      200: body("A new access token, with the same refresh token.", SessionTokensDtoSchema, "session-tokens.valid"),
      400: badRequest,
      401: error("The session has ended: unknown token, logged out, merged or deleted. Sign in again.", "errors/unauthorized"),
      429: error("Too many requests from this address.", "errors/rate-limited"),
      ...publicServerErrors
    }
  },
  authed({
    method: "POST",
    path: "/api/v1/auth/logout",
    operationId: "logOut",
    summary:
      "End a member's session, so its tokens get 401, and forget this installation's FCM token when installationId is given. Other sessions stay signed in. A guest has no sign-out: it would lose the guest's data. installationId is opaque to the server.",
    phase: 1,
    request: { kind: "json", schema: LogoutRequestSchema, example: "requests/auth-logout" },
    responses: {
      204: empty("Signed out. The device row is removed, was not registered, or no installationId was given."),
      400: badRequest,
      403: error("The caller is a guest. Nothing changed.", "errors/sign-in-required")
    }
  }),
  authed({
    method: "GET",
    path: "/api/v1/me",
    operationId: "getMe",
    summary: "The caller's account, a member or a guest.",
    phase: 1,
    responses: { 200: body("The account.", MeDtoSchema, "me.valid", "me.guest") }
  }),
  authed({
    method: "DELETE",
    path: "/api/v1/me",
    operationId: "deleteMe",
    summary: "Delete the account and all of the user's data, including any pending CV import.",
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
    summary: `Extract a CV file (PDF or DOCX, at most ${CV_UPLOAD_MAX_BYTES / (1024 * 1024)} MiB) as Markdown for review. The file and text are held encrypted under importId for at most ${CV_IMPORT_RETENTION_HOURS} hours, until PUT /me/cv uses them. A new import replaces the pending one. Pending imports are also capped per address and in total, because anonymous accounts are free. A file whose extracted text is over the CV limit gets 413.`,
    phase: 2,
    headers: [integrity(false, "Optional in this draft. Phase 3, which ships Play Integrity, makes it required: a missing or failed token then gets 403 INTEGRITY_FAILED.")],
    request: { kind: "cv-upload" },
    responses: {
      200: body("The extracted text.", CvImportDtoSchema, "cv-import.valid"),
      400: badRequest,
      403: aiRefused,
      413: error("The file, or the text extracted from it, is too large.", "errors/payload-too-large"),
      415: error("Not a PDF or DOCX file.", "errors/unsupported-media-type"),
      422: error("No text could be read, for example a scanned image.", "errors/cv-unreadable"),
      429: error("The plan's quota is used up, or this address has too many pending imports.", "errors/quota-exceeded")
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
    summary: "Store the reviewed CV. importId is random and works only for the user who made the import.",
    phase: 2,
    request: { kind: "json", schema: CvUpdateRequestSchema, example: "requests/cv-update" },
    responses: {
      200: body("The stored CV.", CvDtoSchema, "cv.valid"),
      400: badRequest,
      409: error("That import has expired, was already used, or is not this user's. All three get the same answer.", "errors/conflict")
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
    responses: { 200: body("The job.", JobDtoSchema, "job.valid", "job.closed", "job.hourly"), 400: badRequest, 404: notFound }
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
    responses: { 204: empty("Removed, or was not marked."), 400: badRequest, 404: notFound }
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
    summary: "Add a company careers page to the shared job index. Needs Google sign-in, and each user has a cap, because this adds work for the server.",
    phase: 2,
    request: { kind: "json", schema: CompanyCreateRequestSchema, example: "requests/company-create" },
    responses: {
      200: body("The company.", CompanyDtoSchema, "company.valid"),
      400: badRequest,
      403: error("Anonymous users cannot add companies.", "errors/sign-in-required"),
      429: error("This user has added too many companies.", "errors/quota-exceeded")
    }
  }),
  authed({
    method: "PUT",
    path: "/api/v1/me/devices/{installationId}",
    operationId: "putDevice",
    summary: `Register this installation's FCM token for the caller. Rows are per user and installation, so another user's id changes nothing of theirs. Other users' rows with the same FCM token are removed, because only that phone holds it; a phone that changes user keeps getting push for the new user only. A user has at most ${DEVICE_MAX_PER_USER} devices; the oldest is removed.`,
    phase: 2,
    pathParams: ["installationId"],
    request: { kind: "json", schema: DeviceUpdateRequestSchema, example: "requests/device-update" },
    responses: { 204: empty("Registered."), 400: badRequest }
  }),
  authed({
    method: "DELETE",
    path: "/api/v1/me/devices/{installationId}",
    operationId: "deleteDevice",
    summary: "Stop sending push to this installation.",
    phase: 2,
    pathParams: ["installationId"],
    responses: { 204: empty("Removed, or was not registered."), 400: badRequest }
  }),
  authed({
    method: "POST",
    path: "/api/v1/jobs/{jobId}/evaluations",
    operationId: "startEvaluation",
    summary: "Start an AI evaluation of one job against the user's CV.",
    phase: 3,
    pathParams: ["jobId"],
    headers: [integrity(true, "Required, because this request costs money. A missing or failed token gets 403 INTEGRITY_FAILED, before any AI call.")],
    responses: {
      202: body("Queued. Progress also arrives by push.", EvaluationDtoSchema, "evaluation.queued"),
      400: badRequest,
      403: aiRefused,
      404: notFound,
      429: quotaUsedUp
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
      400: badRequest,
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
