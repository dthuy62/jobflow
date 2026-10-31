import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { isBlockedAddress as defaultIsBlockedAddress } from "./address-guard.js";
import { htmlToText } from "./html-text.js";

// The wrapper, not the model, fetches the posting. The URL comes from the
// workspace projection, never from the phone, and every address the request
// could reach is checked: IP-literal hosts before connecting, and every
// resolved address on every connection (so DNS rebinding cannot switch it).

export const POSTING_TIMEOUT_MS = 20_000;
export const POSTING_MAX_BYTES = 2 * 1024 * 1024;
export const POSTING_MAX_CHARS = 60_000;
export const POSTING_MIN_CHARS = 500;
export const POSTING_MAX_REDIRECTS = 5;

const USER_AGENT = "JobFlow-Wrapper/1.0";
const ALLOWED_CONTENT_TYPES = new Set(["text/html", "text/plain", "application/json"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type PostingFailureReason =
  | "bad-url"
  | "blocked-address"
  | "redirect"
  | "http-status"
  | "content-type"
  | "too-large"
  | "too-short"
  | "timeout"
  | "network";

export type PostingResult =
  | { readonly ok: true; readonly text: string; readonly truncated: boolean }
  | { readonly ok: false; readonly reason: PostingFailureReason };

export interface FetchPostingOptions {
  readonly timeoutMs?: number;
  /** Aborting stops the fetch (it then ends as `timeout`). */
  readonly signal?: AbortSignal;
  /** Test seam: resolves a hostname to every address. */
  readonly resolve?: (hostname: string) => Promise<LookupAddress[]>;
  /** Test seam: the address policy. */
  readonly isBlockedAddress?: (address: string) => boolean;
  /** Test seam: allow the local test server's random port. */
  readonly allowAnyPort?: boolean;
}

class PostingError extends Error {
  constructor(readonly reason: PostingFailureReason) {
    super(reason);
  }
}

export async function fetchPostingText(rawUrl: string, options: FetchPostingOptions = {}): Promise<PostingResult> {
  const isBlocked = options.isBlockedAddress ?? defaultIsBlockedAddress;
  const resolve = options.resolve ?? resolveAll;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), options.timeoutMs ?? POSTING_TIMEOUT_MS);
  const onAbort = (): void => deadline.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) {
    deadline.abort();
  }

  try {
    let url = parsePostingUrl(rawUrl, options.allowAnyPort === true);
    for (let redirects = 0; ; redirects += 1) {
      assertHostAllowed(url, isBlocked);
      const response = await request(url, guardedLookup(resolve, isBlocked), deadline.signal);

      if (REDIRECT_STATUSES.has(response.statusCode ?? 0)) {
        response.resume();
        const next = checkRedirect(url, response.headers.location);
        if (!next || redirects >= POSTING_MAX_REDIRECTS) {
          throw new PostingError("redirect");
        }
        url = parsePostingUrl(next.href, options.allowAnyPort === true);
        continue;
      }

      return toPostingResult(response, await readBody(response));
    }
  } catch (error) {
    if (error instanceof PostingError) {
      return { ok: false, reason: error.reason };
    }
    return { ok: false, reason: deadline.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/** The next URL for a redirect, or `undefined` when it is not allowed (only `http:` → `https:` may change scheme). */
export function checkRedirect(current: URL, location: string | undefined): URL | undefined {
  if (!location) {
    return undefined;
  }
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return undefined;
  }
  const sameScheme = next.protocol === current.protocol;
  const upgrade = current.protocol === "http:" && next.protocol === "https:";
  return sameScheme || upgrade ? next : undefined;
}

function parsePostingUrl(rawUrl: string, allowAnyPort: boolean): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PostingError("bad-url");
  }
  const portAllowed = url.port === "" || url.port === "80" || url.port === "443" || allowAnyPort;
  if (!["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || !portAllowed) {
    throw new PostingError("bad-url");
  }
  return url;
}

/** WHATWG parsing already turned `2130706433` or `0x7f.1` into `127.0.0.1`. */
function assertHostAllowed(url: URL, isBlocked: (address: string) => boolean): void {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && isBlocked(host)) {
    throw new PostingError("blocked-address");
  }
}

function guardedLookup(
  resolve: (hostname: string) => Promise<LookupAddress[]>,
  isBlocked: (address: string) => boolean
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some((entry) => isBlocked(entry.address))) {
          callback(Object.assign(new Error("blocked address"), { code: "EJOBFLOWBLOCKED" }), "", 4);
          return;
        }
        if (options.all) {
          (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
          return;
        }
        const [first] = addresses;
        callback(null, first?.address ?? "", first?.family ?? 4);
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 4)
    );
  };
}

function resolveAll(hostname: string): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses)
    );
  });
}

function request(url: URL, lookup: LookupFunction, signal: AbortSignal): Promise<IncomingMessage> {
  const transport = url.protocol === "https:" ? https : http;
  // A fresh agent per request: never the global agent, so no environment proxy.
  const agent = new transport.Agent({ lookup, keepAlive: false });

  return new Promise((resolve, reject) => {
    const outgoing = transport.request(
      url,
      {
        method: "GET",
        agent,
        signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,application/json;q=0.9" }
      },
      resolve
    );
    outgoing.on("error", (error: NodeJS.ErrnoException) => {
      agent.destroy();
      reject(error.code === "EJOBFLOWBLOCKED" ? new PostingError("blocked-address") : error);
    });
    outgoing.on("close", () => agent.destroy());
    outgoing.end();
  });
}

async function readBody(response: IncomingMessage): Promise<Buffer> {
  const declared = Number(response.headers["content-length"]);
  if (Number.isFinite(declared) && declared > POSTING_MAX_BYTES) {
    response.destroy();
    throw new PostingError("too-large");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > POSTING_MAX_BYTES) {
      response.destroy();
      throw new PostingError("too-large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function toPostingResult(response: IncomingMessage, body: Buffer): PostingResult {
  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    return { ok: false, reason: "http-status" };
  }
  const contentType = (response.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return { ok: false, reason: "content-type" };
  }

  const raw = body.toString("utf8");
  const text = (contentType === "text/html" ? htmlToText(raw) : raw).trim();
  if (text.length < POSTING_MIN_CHARS) {
    return { ok: false, reason: "too-short" };
  }
  return text.length > POSTING_MAX_CHARS
    ? { ok: true, text: text.slice(0, POSTING_MAX_CHARS), truncated: true }
    : { ok: true, text, truncated: false };
}
