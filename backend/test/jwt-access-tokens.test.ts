import { randomUUID } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, SignJWT, UnsecuredJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER, createJwtAccessTokens } from "../src/adapters/jwt-access-tokens.js";
import { InvalidTokenError, type SessionId, type UserId } from "../src/core/identity.js";

const NEW = { kid: "new", secret: "n".repeat(32) };
const OLD = { kid: "old", secret: "o".repeat(32) };
const userId = randomUUID() as UserId;
const sessionId = randomUUID() as SessionId;

const sign = (
  claims: Record<string, unknown>,
  { kid = NEW.kid, secret = NEW.secret, alg = "HS256", iss = ACCESS_TOKEN_ISSUER, aud = ACCESS_TOKEN_AUDIENCE, iat = "0s", exp = "15m" } = {}
) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg, kid })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

describe("the access tokens", () => {
  const tokens = createJwtAccessTokens([NEW, OLD]);
  afterEach(() => {
    vi.useRealTimers();
  });

  it("carry only iss, aud, sub, sid, iat and exp, with kid in the header, for 15 minutes", async () => {
    const token = await tokens.issue(userId, sessionId);
    expect(decodeProtectedHeader(token)).toEqual({ alg: "HS256", kid: "new", typ: "JWT" });
    const claims = decodeJwt(token);
    expect(Object.keys(claims).sort()).toEqual(["aud", "exp", "iat", "iss", "sid", "sub"]);
    expect(claims.exp! - claims.iat!).toBe(900);
    expect(tokens.expiresInSeconds).toBe(900);
    await expect(tokens.verify(token)).resolves.toEqual({ userId, sessionId });
  });

  it("verify with every listed key, so the signing key can rotate without signing anyone out", async () => {
    const fromOld = await createJwtAccessTokens([OLD]).issue(userId, sessionId);
    await expect(tokens.verify(fromOld)).resolves.toEqual({ userId, sessionId });
    await expect(createJwtAccessTokens([NEW]).verify(fromOld)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("end after 15 minutes, with a few seconds of clock difference", async () => {
    const token = await tokens.issue(userId, sessionId);
    vi.useFakeTimers({ now: Date.now() + 900_000 + 2_000 });
    await expect(tokens.verify(token)).resolves.toEqual({ userId, sessionId });
    vi.setSystemTime(Date.now() + 10_000);
    await expect(tokens.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it.each([
    ["no kid", () => new SignJWT({ sub: userId, sid: sessionId }).setProtectedHeader({ alg: "HS256" }).setIssuer(ACCESS_TOKEN_ISSUER).setAudience(ACCESS_TOKEN_AUDIENCE).setIssuedAt().setExpirationTime("15m").sign(new TextEncoder().encode(NEW.secret))],
    ["an unknown kid", () => sign({ sub: userId, sid: sessionId }, { kid: "other" })],
    ["a known kid with another secret", () => sign({ sub: userId, sid: sessionId }, { secret: "x".repeat(32) })],
    ["HS512", () => sign({ sub: userId, sid: sessionId }, { alg: "HS512", secret: NEW.secret.repeat(2) })],
    ["alg none", async () => new UnsecuredJWT({ sub: userId, sid: sessionId }).setIssuer(ACCESS_TOKEN_ISSUER).setAudience(ACCESS_TOKEN_AUDIENCE).setIssuedAt().setExpirationTime("15m").encode()],
    ["another issuer", () => sign({ sub: userId, sid: sessionId }, { iss: "https://securetoken.google.com/demo-jobflow" })],
    ["another audience", () => sign({ sub: userId, sid: sessionId }, { aud: "demo-jobflow" })],
    ["no sid", () => sign({ sub: userId })],
    ["no sub", () => sign({ sid: sessionId })],
    ["a sub that is not a uuid", () => sign({ sub: "firebase-uid", sid: sessionId })],
    ["a sid that is not a uuid", () => sign({ sub: userId, sid: 7 })],
    ["an iat in the future", () => sign({ sub: userId, sid: sessionId }, { iat: "1h from now", exp: "2h" })],
    ["a lifetime past 15 minutes", () => sign({ sub: userId, sid: sessionId }, { iat: "1h ago", exp: "1h" })],
    ["no JWT at all", async () => "not-a-jwt"],
    ["an empty string", async () => ""]
  ])("refuse a token with %s", async (_name, make) => {
    await expect(tokens.verify(await make())).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("need a key", () => {
    expect(() => createJwtAccessTokens([])).toThrow();
  });
});
