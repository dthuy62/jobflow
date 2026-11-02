import { createServer, type Server } from "node:http";
import { createLocalJWKSet, createRemoteJWKSet, exportJWK, exportSPKI, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { errors } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  it("marks an anonymous token isAnonymous", async () => {
    await expect(verifier().verify(await token({ anonymous: true }))).resolves.toEqual({ subject: "subject-1", isAnonymous: true });
  });

  it("allows a few seconds of clock difference", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifier().verify(await token({}, { iat: now + 2 }))).resolves.toMatchObject({ subject: "subject-1" });
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
  it("can be created without any network call", () => {
    expect(createFirebaseAuthVerifier("demo-jobflow").verify).toEqual(expect.any(Function));
  });
});
