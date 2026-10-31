import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { htmlToText } from "../src/evaluation/html-text.js";
import { fetchPostingText, type FetchPostingOptions } from "../src/evaluation/posting-fetcher.js";

const LONG_TEXT = "Senior Android engineer building offline-first apps. ".repeat(20);

let server: Server;
let port: number;
let requests: string[];
let handler: (request: IncomingMessage, response: ServerResponse) => void;

beforeEach(async () => {
  requests = [];
  handler = (_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<html><body><p>${LONG_TEXT}</p></body></html>`);
  };
  server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Test-only options: `jobs.test` and `other.test` resolve to the local server, which is allowed. */
function testOptions(extra: Partial<FetchPostingOptions> = {}): FetchPostingOptions {
  return {
    resolve: async (hostname) => {
      if (hostname === "jobs.test" || hostname === "other.test") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      if (hostname === "mixed.test") {
        return [
          { address: "127.0.0.1", family: 4 },
          { address: "10.0.0.1", family: 4 }
        ];
      }
      throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    },
    isBlockedAddress: (address) => address !== "127.0.0.1",
    allowAnyPort: true,
    ...extra
  };
}

describe("fetchPostingText", () => {
  it("returns the visible text of an HTML posting", async () => {
    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<html><head><title>x</title><script>stealCookies()</script></head><body><h1>Role</h1><p>${LONG_TEXT}</p></body></html>`);
    };

    const result = await fetchPostingText(`http://jobs.test:${port}/job/1`, testOptions());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Senior Android engineer");
      expect(result.text).not.toContain("stealCookies");
      expect(result.truncated).toBe(false);
    }
  });

  it.each([
    "http://127.0.0.1/job",
    "http://[::1]/job",
    "http://2130706433/job",
    "http://0x7f.1/job",
    "http://[::ffff:127.0.0.1]/job",
    "https://169.254.169.254/latest/meta-data"
  ])("refuses the IP literal %s before connecting", async (url) => {
    const result = await fetchPostingText(url);

    expect(result).toEqual({ ok: false, reason: "blocked-address" });
    expect(requests).toEqual([]);
  });

  it("refuses a host when any resolved address is blocked", async () => {
    const result = await fetchPostingText(`http://mixed.test:${port}/job`, testOptions());

    expect(result).toEqual({ ok: false, reason: "blocked-address" });
    expect(requests).toEqual([]);
  });

  it("refuses a redirect to a blocked address", async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: "http://10.0.0.1/admin" });
      response.end();
    };

    const result = await fetchPostingText(`http://jobs.test:${port}/job`, testOptions());

    expect(result).toEqual({ ok: false, reason: "blocked-address" });
    expect(requests).toEqual(["/job"]);
  });

  it("follows a relative redirect on an allowed host", async () => {
    handler = (request, response) => {
      if (request.url === "/old") {
        response.writeHead(301, { location: "/new" });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(LONG_TEXT);
    };

    const result = await fetchPostingText(`http://jobs.test:${port}/old`, testOptions());

    expect(result.ok).toBe(true);
    expect(requests).toEqual(["/old", "/new"]);
  });

  it("stops after five redirects", async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: `http://jobs.test:${port}/again` });
      response.end();
    };

    expect(await fetchPostingText(`http://jobs.test:${port}/loop`, testOptions())).toEqual({
      ok: false,
      reason: "redirect"
    });
    expect(requests.length).toBe(6);
  });

  it.each([
    "file:///etc/passwd",
    "ftp://jobs.test/job",
    "http://user:pass@jobs.test/job",
    "http://jobs.test:8080/job",
    "not a url"
  ])("refuses the URL %s", async (url) => {
    expect(await fetchPostingText(url)).toEqual({ ok: false, reason: "bad-url" });
  });

  it("refuses an https to http downgrade", async () => {
    const { checkRedirect } = await import("../src/evaluation/posting-fetcher.js");

    expect(checkRedirect(new URL("https://jobs.example/a"), "http://jobs.example/b")).toBeUndefined();
    expect(checkRedirect(new URL("http://jobs.example/a"), "https://jobs.example/b")?.href).toBe(
      "https://jobs.example/b"
    );
  });

  it("maps HTTP errors, content types, size and short pages", async () => {
    handler = (_request, response) => {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("missing");
    };
    expect(await fetchPostingText(`http://jobs.test:${port}/a`, testOptions())).toEqual({
      ok: false,
      reason: "http-status"
    });

    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      response.end("png");
    };
    expect(await fetchPostingText(`http://jobs.test:${port}/b`, testOptions())).toEqual({
      ok: false,
      reason: "content-type"
    });

    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("x".repeat(3 * 1024 * 1024));
    };
    expect(await fetchPostingText(`http://jobs.test:${port}/c`, testOptions())).toEqual({
      ok: false,
      reason: "too-large"
    });

    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<div id=root></div><script>render()</script>");
    };
    expect(await fetchPostingText(`http://jobs.test:${port}/d`, testOptions())).toEqual({
      ok: false,
      reason: "too-short"
    });
  });

  it("times out a slow server", async () => {
    handler = () => undefined;

    expect(await fetchPostingText(`http://jobs.test:${port}/slow`, testOptions({ timeoutMs: 200 }))).toEqual({
      ok: false,
      reason: "timeout"
    });
  });

  it("cuts long text and says so", async () => {
    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("word ".repeat(30_000));
    };

    const result = await fetchPostingText(`http://jobs.test:${port}/long`, testOptions());

    expect(result.ok && result.truncated).toBe(true);
    expect(result.ok && result.text.length).toBe(60_000);
  });

  it("ignores proxy environment variables", async () => {
    const previous = process.env.HTTP_PROXY;
    process.env.HTTP_PROXY = "http://127.0.0.1:1";
    try {
      expect((await fetchPostingText(`http://jobs.test:${port}/p`, testOptions())).ok).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.HTTP_PROXY;
      } else {
        process.env.HTTP_PROXY = previous;
      }
    }
  });
});

describe("htmlToText", () => {
  it("drops non-content elements, keeps block breaks and decodes entities", () => {
    const text = htmlToText(
      "<head><style>p{}</style></head><body><!-- hidden --><h2>Role &amp; team</h2><p>Line&nbsp;one<br>Line two</p><noscript>enable js</noscript><svg><text>logo</text></svg><ul><li>A &#38; B</li><li>&#x43;</li></ul></body>"
    );

    expect(text).toBe("Role & team\nLine one\nLine two\nA & B\nC");
  });

  it("uses a JobPosting description from JSON-LD when the page has one", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Platform Engineer",
      description: "<p>Build &amp; run things.</p>"
    })}</script></head><body><div id="app"></div></body></html>`;

    expect(htmlToText(html)).toBe("Platform Engineer\nBuild & run things.");
  });
});
