import { z } from "zod";

export interface Config {
  readonly env: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly firebaseProjectId: string;
  /** Trusted proxies in front of the API. 0 ignores `X-Forwarded-For`. */
  readonly trustProxyHops: number;
}

const DEV_PASSWORD_MARKER = "dev-only";

const EnvSchema = z.object({
  JOBFLOW_ENV: z.enum(["development", "test", "production"]),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.string().regex(/^[1-9]\d{0,4}$/).transform(Number).pipe(z.number().max(65535)).default(8080),
  DATABASE_URL: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  TRUST_PROXY: z.string().regex(/^\d{1,2}$/).transform(Number).default(0)
});

/** Throws naming the variables, never their values, because this message reaches the logs. */
export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`);
  }
  const { JOBFLOW_ENV, HOST, PORT, DATABASE_URL, FIREBASE_PROJECT_ID, TRUST_PROXY } = parsed.data;
  if (JOBFLOW_ENV === "production" && DATABASE_URL.includes(DEV_PASSWORD_MARKER)) {
    throw new Error("Invalid configuration: DATABASE_URL holds a development password");
  }
  return {
    env: JOBFLOW_ENV,
    host: HOST,
    port: PORT,
    databaseUrl: DATABASE_URL,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    trustProxyHops: TRUST_PROXY
  };
}

/** The owner role's URL. Only the migrate step reads it; the API never holds it. */
export function loadMigrationUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  const url = env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("Invalid configuration: DATABASE_MIGRATION_URL");
  return url;
}
