import { createHash } from "node:crypto";

export function normalizeOfferUrl(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return undefined;
  }

  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function offerIdForUrl(normalizedUrl: string): string {
  return `offer_${shortHash(`url:${normalizedUrl}`)}`;
}

export function offerIdForTrackerNumber(trackerNumber: string): string {
  return `offer_${shortHash(`tracker:${trackerNumber}`)}`;
}

/** Career Ops report numbers are zero-padded to three digits (`#4` → `004`). */
export function normalizeReportNumber(value: string): string | undefined {
  const match = value.match(/^#?(\d{1,6})$/);
  return match?.[1] ? match[1].padStart(3, "0") : undefined;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
