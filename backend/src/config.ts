import { parse } from "pg-connection-string";
import { z } from "zod";
import type { SigningKey } from "./adapters/jwt-access-tokens.js";

export interface Config {
  readonly env: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly firebaseProjectId: string;
  /** The first signs access tokens; all verify them. */
  readonly jwtSigningKeys: readonly SigningKey[];
  /** Trusted proxies in front of the API. 0 ignores `X-Forwarded-For`. */
  readonly trustProxyHops: number;
}

const DEV_PASSWORD_PREFIX = "dev-only-";
/** HS256 needs a secret at least as long as its 256-bit output. Characters, not bytes, so a base64 secret of 32 bytes passes. */
const SIGNING_SECRET_MIN_CHARS = 32;
const SigningKeySchema = z.string().regex(new RegExp(`^[A-Za-z0-9_-]{1,64}:[^\\s,]{${SIGNING_SECRET_MIN_CHARS},}$`));

const JobflowEnvSchema = z.enum(["development", "test", "production"]);
const PostgresUrlSchema = z.string().regex(/^postgres(?:ql)?:\/\/./);

/** `kid:secret` pairs, comma-separated, with unique kids. The regex keeps a secret out of the error. */
const SigningKeysSchema = z
  .string()
  .transform((value) => value.split(","))
  .pipe(z.array(SigningKeySchema).min(1))
  .transform((pairs) =>
    pairs.map((pair) => {
      const at = pair.indexOf(":");
      return { kid: pair.slice(0, at), secret: pair.slice(at + 1) };
    })
  )
  .refine((keys) => new Set(keys.map(({ kid }) => kid)).size === keys.length);

/** Reads the password as the driver does, including percent-encoding and the query string. */
function hasDevelopmentPassword(url: string): boolean {
  return parse(url).password?.startsWith(DEV_PASSWORD_PREFIX) ?? false;
}

const EnvSchema = z.object({
  JOBFLOW_ENV: JobflowEnvSchema,
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.string().regex(/^[1-9]\d{0,4}$/).transform(Number).pipe(z.number().max(65535)).default(8080),
  DATABASE_URL: PostgresUrlSchema,
  FIREBASE_PROJECT_ID: z.string().min(1),
  JWT_SIGNING_KEYS: SigningKeysSchema,
  TRUST_PROXY: z.string().regex(/^\d{1,2}$/).transform(Number).default(0)
});

/** Throws naming the variables, never their values, because this message reaches the logs. */
export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`);
  }
  const { JOBFLOW_ENV, HOST, PORT, DATABASE_URL, FIREBASE_PROJECT_ID, JWT_SIGNING_KEYS, TRUST_PROXY } = parsed.data;
  if (JOBFLOW_ENV === "production" && hasDevelopmentPassword(DATABASE_URL)) {
    throw new Error("Invalid configuration: DATABASE_URL holds a development password");
  }
  // Firebase's own prefix for projects with no real backend, as in .env.example.
  if (JOBFLOW_ENV === "production" && FIREBASE_PROJECT_ID.startsWith("demo-")) {
    throw new Error("Invalid configuration: FIREBASE_PROJECT_ID is a development project");
  }
  // Any key, not only the signing one: a known secret that still verifies lets anyone mint tokens.
  if (JOBFLOW_ENV === "production" && JWT_SIGNING_KEYS.some(({ secret }) => secret.startsWith(DEV_PASSWORD_PREFIX))) {
    throw new Error("Invalid configuration: JWT_SIGNING_KEYS holds a development key");
  }
  return {
    env: JOBFLOW_ENV,
    host: HOST,
    port: PORT,
    databaseUrl: DATABASE_URL,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    jwtSigningKeys: JWT_SIGNING_KEYS,
    trustProxyHops: TRUST_PROXY
  };
}

/** The worker needs no sign-in settings. Refuses the same development password as the API. */
export function loadWorkerConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): { readonly databaseUrl: string } {
  const jobflowEnv = JobflowEnvSchema.safeParse(env.JOBFLOW_ENV);
  if (!jobflowEnv.success) throw new Error("Invalid configuration: JOBFLOW_ENV");
  const url = PostgresUrlSchema.safeParse(env.DATABASE_URL);
  if (!url.success) throw new Error("Invalid configuration: DATABASE_URL");
  if (jobflowEnv.data === "production" && hasDevelopmentPassword(url.data)) {
    throw new Error("Invalid configuration: DATABASE_URL holds a development password");
  }
  return { databaseUrl: url.data };
}

/** The owner role's URL. Only the migrate step reads it; the API never holds it. */
export function loadMigrationUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  // Validated here too, or a misspelled value would silently turn off the production check.
  const jobflowEnv = JobflowEnvSchema.safeParse(env.JOBFLOW_ENV);
  if (!jobflowEnv.success) throw new Error("Invalid configuration: JOBFLOW_ENV");
  const url = PostgresUrlSchema.safeParse(env.DATABASE_MIGRATION_URL);
  if (!url.success) throw new Error("Invalid configuration: DATABASE_MIGRATION_URL");
  if (jobflowEnv.data === "production" && hasDevelopmentPassword(url.data)) {
    throw new Error("Invalid configuration: DATABASE_MIGRATION_URL holds a development password");
  }
  return url.data;
}
