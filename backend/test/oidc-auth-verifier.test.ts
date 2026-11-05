import { createServer, type Server } from "node:http";
import { createLocalJWKSet, createRemoteJWKSet, exportJWK, exportSPKI, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { errors } from "jose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAuthVerifier, createOidcAuthVerifier } from "../src/adapters/oidc-auth-verifier.js";
import { AuthUnavailableError, InvalidTokenError } from "../src/core/identity.js";

const ISSUER = "https://securetoken.google.com/demo-jobflow";
const AUDIENCE = "demo-jobflow";

describe("the OIDC verifier", () => {
  let privateKey: CryptoKey;
  let publicPem: string;
  let otherKey: CryptoKey;
  let keys: JWTVerifyGetKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicPem = await exportSPKI(pair.publicKey);
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk = await exportJWK(pair.publicKey);
    keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "key-1", alg: "RS256", use: "sig" }] });
  });

  const verifier = () => createOidcAuthVerifier({ issuer: ISSUER, audience: AUDIENCE, keys, isAnonymous: (payload) => payload.anonymous === true });

  function token(claims: Record<string, unknown> = {}, options: { issuer?: string; audience?: string; subject?: string; kid?: string; key?: CryptoKey; iat?: number; exp?: number } = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: options.kid ?? "key-1" })
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? AUDIENCE)
      .setSubject(options.subject ?? "subject-1")
      .setIssuedAt(options.iat ?? now - 10)
      .setExpirationTime(options.exp ?? now + 3600)
      .sign(options.key ?? privateKey);
  }

  it("accepts a valid token and returns its subject", async () => {
    await expect(verifier().verify(await token())).resolves.toEqual({ subject: "subject-1", isAnonymous: false });
  });

  it("asks the caller which tokens are anonymous", async () => {
    await expect(verifier().verify(await token({ anonymous: true }))).resolves.toEqual({ subject: "subject-1", isAnonymous: true });
  });

  it("allows a few seconds of clock difference", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifier().verify(await token({}, { iat: now + 2 }))).resolves.toMatchObject({ subject: "subject-1" });
    await expect(verifier().verify(await token({}, { iat: now - 60, exp: now - 3 }))).resolves.toMatchObject({ subject: "subject-1" });
  });

  it("allows no more than that", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifier().verify(await token({}, { iat: now - 60, exp: now - 30 }))).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(verifier().verify(await token({}, { iat: now + 30, exp: now + 60 }))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("accepts only RS256, even when the published key names no algorithm", async () => {
    const pair = await generateKeyPair("RS384", { extractable: true });
    const open = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "key-3" }] });
    const signed = await new SignJWT({})
      .setProtectedHeader({ alg: "RS384", kid: "key-3" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("subject-1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(pair.privateKey);
    const lax = createOidcAuthVerifier({ issuer: ISSUER, audience: AUDIENCE, keys: open, isAnonymous: () => false });
    await expect(lax.verify(signed)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  const invalid: readonly (readonly [string, () => Promise<string>])[] = [
    ["wrong issuer", () => token({}, { issuer: "https://securetoken.google.com/other" })],
    ["wrong audience", () => token({}, { audience: "other" })],
    ["expired", () => token({}, { iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 })],
    ["issued in the future", () => token({}, { iat: Math.floor(Date.now() / 1000) + 600, exp: Math.floor(Date.now() / 1000) + 3600 })],
    ["empty subject", () => token({}, { subject: "" })],
    ["an overlong subject", () => token({}, { subject: "x".repeat(256) })],
    [
      "no expiry",
      () =>
        new SignJWT({})
          .setProtectedHeader({ alg: "RS256", kid: "key-1" })
          .setIssuer(ISSUER)
          .setAudience(AUDIENCE)
          .setSubject("subject-1")
          .setIssuedAt()
          .sign(privateKey)
    ],
    [
      "alg none",
      async () => {
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
        return `${encode({ alg: "none", kid: "key-1" })}.${encode({ iss: ISSUER, aud: AUDIENCE, sub: "subject-1", exp: 9999999999 })}.`;
      }
    ],
    [
      "HS256 signed with the public key",
      () =>
        new SignJWT({})
          .setProtectedHeader({ alg: "HS256", kid: "key-1" })
          .setIssuer(ISSUER)
          .setAudience(AUDIENCE)
          .setSubject("subject-1")
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(new TextEncoder().encode(publicPem))
    ],
    ["unknown kid", () => token({}, { kid: "key-2" })],
    ["bad signature", () => token({}, { key: otherKey })],
    [
      "an unknown critical header, which must not look like an outage",
      async () => {
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
        return `${encode({ alg: "RS256", kid: "key-1", crit: ["x"], x: 1 })}.${encode({ sub: "subject-1" })}.AAAA`;
      }
    ],
    ["not a JWT", async () => "not-a-jwt"],
    ["empty", async () => ""]
  ];

  it.each(invalid)("rejects %s with InvalidTokenError", async (_name, build) => {
    await expect(verifier().verify(await build())).rejects.toBeInstanceOf(InvalidTokenError);
  });

  describe("when the keys cannot be read", () => {
    const failingKeys = (error: Error): JWTVerifyGetKey => async () => {
      throw error;
    };

    it.each([
      ["a network failure", new TypeError("fetch failed")],
      ["a timeout", new errors.JWKSTimeout()],
      ["a bad response", new errors.JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response")]
    ])("throws AuthUnavailableError on %s", async (_name, error) => {
      const unavailable = createOidcAuthVerifier({ issuer: ISSUER, audience: AUDIENCE, keys: failingKeys(error), isAnonymous: () => false });
      await expect(unavailable.verify(await token())).rejects.toBeInstanceOf(AuthUnavailableError);
    });

    describe("from a real endpoint", () => {
      let server: Server;
      let url: URL;

      beforeAll(async () => {
        server = createServer((_request, response) => {
          response.statusCode = 500;
          response.end("down");
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const address = server.address();
        if (address === null || typeof address === "string") throw new Error("No port");
        url = new URL(`http://127.0.0.1:${address.port}/keys`);
      });
      afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
      });

      it("throws AuthUnavailableError when the key endpoint fails", async () => {
        const unavailable = createOidcAuthVerifier({ issuer: ISSUER, audience: AUDIENCE, keys: createRemoteJWKSet(url), isAnonymous: () => false });
        await expect(unavailable.verify(await token())).rejects.toBeInstanceOf(AuthUnavailableError);
      });
    });
  });
});

describe("the Firebase verifier", () => {
  const PROJECT = "jobflow-test";
  const KEYS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
  let privateKey: CryptoKey;
  let jwks: unknown;
  const fetched: string[] = [];

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), kid: "key-1", alg: "RS256", use: "sig" }] };
  });

  beforeEach(() => {
    fetched.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        fetched.push(String(url));
        return new Response(JSON.stringify(jwks), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const firebaseToken = (provider: string, project = PROJECT) =>
    new SignJWT({ firebase: { sign_in_provider: provider } })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer(`https://securetoken.google.com/${project}`)
      .setAudience(project)
      .setSubject("firebase-uid")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  it("reads keys from Google's documented endpoint", async () => {
    await createFirebaseAuthVerifier(PROJECT, "api-key").verify(await firebaseToken("google.com"));
    expect(fetched).toEqual([KEYS_URL]);
  });

  it("marks a firebase anonymous token isAnonymous", async () => {
    await expect(createFirebaseAuthVerifier(PROJECT, "api-key").verify(await firebaseToken("anonymous"))).resolves.toEqual({ subject: "firebase-uid", isAnonymous: true });
  });

  it("marks a Google sign-in as not anonymous", async () => {
    await expect(createFirebaseAuthVerifier(PROJECT, "api-key").verify(await firebaseToken("google.com"))).resolves.toEqual({ subject: "firebase-uid", isAnonymous: false });
  });

  it("rejects a token from another Firebase project", async () => {
    await expect(createFirebaseAuthVerifier(PROJECT, "api-key").verify(await firebaseToken("google.com", "another-project"))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects the other project's issuer even with this project's audience", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer("https://securetoken.google.com/another-project")
      .setAudience(PROJECT)
      .setSubject("firebase-uid")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    await expect(createFirebaseAuthVerifier(PROJECT, "api-key").verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("keeps verifying a known key 30 minutes into an outage, and reports an outage after the hour", async () => {
    const signed = await firebaseToken("google.com");
    const verifier = createFirebaseAuthVerifier(PROJECT, "api-key");
    await verifier.verify(signed);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    try {
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 30 * 60_000 });
      await expect(verifier.verify(signed)).resolves.toBeDefined();
      vi.setSystemTime(Date.now() + 31 * 60_000);
      // Its own expiry is an hour too, so this is checked with a token that outlives the cache.
      const longLived = await new SignJWT({ firebase: { sign_in_provider: "google.com" } })
        .setProtectedHeader({ alg: "RS256", kid: "key-1" })
        .setIssuer(`https://securetoken.google.com/${PROJECT}`)
        .setAudience(PROJECT)
        .setSubject("firebase-uid")
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(privateKey);
      await expect(verifier.verify(longLived)).rejects.toBeInstanceOf(AuthUnavailableError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not sign users out when the key endpoint answers with an empty set", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [] }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(createFirebaseAuthVerifier(PROJECT, "api-key").verify(await firebaseToken("google.com"))).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});

describe("the Firebase lookup of whether a user is still anonymous", () => {
  const verifier = createFirebaseAuthVerifier("jobflow-test", "api-key");
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const answer = (status: number, body: unknown) => {
    const respond = vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", respond);
    return respond;
  };
  const failure = (message: string) => ({ error: { code: 400, message } });

  it("sends the token to Firebase, with the key in a header and not the URL, and a time limit", async () => {
    const respond = answer(200, { users: [{ localId: "uid" }] });
    await verifier.stillAnonymous("guest-token");
    const [url, init] = respond.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://identitytoolkit.googleapis.com/v1/accounts:lookup");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ idToken: "guest-token" });
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("api-key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["no provider field, as the emulator answers for an anonymous user", { users: [{ localId: "uid" }] }, true],
    ["an empty provider list", { users: [{ localId: "uid", providerUserInfo: [] }] }, true],
    ["a linked provider", { users: [{ localId: "uid", providerUserInfo: [{ providerId: "google.com" }] }] }, false]
  ])("reads %s", async (_name, body, expected) => {
    answer(200, body);
    await expect(verifier.stillAnonymous("t")).resolves.toBe(expected);
  });

  it.each(["INVALID_ID_TOKEN", "USER_NOT_FOUND", "TOKEN_EXPIRED", "USER_DISABLED"])("treats %s as a bad token", async (message) => {
    answer(400, failure(message));
    await expect(verifier.stillAnonymous("t")).rejects.toBeInstanceOf(InvalidTokenError);
  });

  // Each of these says nothing about the user, so no account may close on it.
  it.each([
    ["a bad API key", 400, failure("API key not valid. Please pass a valid API key.")],
    ["a key that may not call this API", 403, failure("PERMISSION_DENIED")],
    ["a rate limit", 429, failure("QUOTA_EXCEEDED")],
    ["a server error", 500, "down"],
    ["a body that is not JSON", 200, "<html>"],
    ["no user in the answer", 200, { kind: "lookup" }],
    ["a provider list of the wrong type", 200, { users: [{ providerUserInfo: "google.com" }] }]
  ])("throws AuthUnavailableError on %s", async (_name, status, body) => {
    answer(status, body);
    await expect(verifier.stillAnonymous("t")).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("throws AuthUnavailableError when the network fails, with no key in the error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const error = await verifier.stillAnonymous("t").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthUnavailableError);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain("api-key");
  });
});
