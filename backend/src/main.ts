import { createFirebaseAuthVerifier } from "./adapters/oidc-auth-verifier.js";
import { createPgDeviceRepository } from "./adapters/pg-device-repository.js";
import { createPgUserRepository } from "./adapters/pg-user-repository.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { describeFailure } from "./logging.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl, (error) => server.log.error({ err: error }, "idle database client failed"));
  const server = await createServer({
    config,
    pool,
    authVerifier: createFirebaseAuthVerifier(config.firebaseProjectId),
    users: createPgUserRepository(pool),
    devices: createPgDeviceRepository(pool)
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server
        .close()
        .then(() => pool.end())
        .finally(() => process.exit(0));
    });
  }

  await server.listen({ host: config.host, port: config.port });
  server.log.info({ port: config.port }, "listening");
}

main().catch((error: unknown) => {
  console.error(`Startup failed: ${describeFailure(error)}`);
  process.exitCode = 1;
});
