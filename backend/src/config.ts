import { parse } from "pg-connection-string";
import { z } from "zod";

export interface Config {
  readonly env: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly firebaseProjectId: string;
  /** The project's web API key, for asking Firebase about a user's own token. */
  readonly firebaseApiKey: string;
  /** Trusted proxies in front of the API. 0 ignores `X-Forwarded-For`. */
  readonly trustProxyHops: number;
}

const DEV_PASSWORD_PREFIX = "dev-only-";

const JobflowEnvSchema = z.enum(["development", "test", "production"]);
const PostgresUrlSchema = z.string().regex(/^postgres(?:ql)?:\/\/./);

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
  FIREBASE_API_KEY: z.string().min(1),
  TRUST_PROXY: z.string().regex(/^\d{1,2}$/).transform(Number).default(0)
});

/** Throws naming the variables, never their values, because this message reaches the logs. */
export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`);
  }
  const { JOBFLOW_ENV, HOST, PORT, DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_API_KEY, TRUST_PROXY } = parsed.data;
  if (JOBFLOW_ENV === "production" && hasDevelopmentPassword(DATABASE_URL)) {
    throw new Error("Invalid configuration: DATABASE_URL holds a development password");
  }
  // Firebase's own prefix for projects with no real backend, as in .env.example.
  if (JOBFLOW_ENV === "production" && FIREBASE_PROJECT_ID.startsWith("demo-")) {
    throw new Error("Invalid configuration: FIREBASE_PROJECT_ID is a development project");
  }
  if (JOBFLOW_ENV === "production" && FIREBASE_API_KEY.startsWith("demo-")) {
    throw new Error("Invalid configuration: FIREBASE_API_KEY is a development key");
  }
  return {
    env: JOBFLOW_ENV,
    host: HOST,
    port: PORT,
    databaseUrl: DATABASE_URL,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    firebaseApiKey: FIREBASE_API_KEY,
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
