import { HealthDtoSchema, type HealthDto } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const CHECK_TIMEOUT_MS = 1_000;

async function checkDatabase(pool: Pick<Pool, "query">): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("The database check timed out.")), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([pool.query("select 1"), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function registerHealthRoutes(scope: FastifyInstance, pool: Pick<Pool, "query">): void {
  scope.get("/health", async (request, reply) => {
    let body: HealthDto = { status: "ok", checks: { database: "ok" } };
    try {
      await checkDatabase(pool);
    } catch (error) {
      request.log.error({ err: error }, "database check failed");
      body = { status: "degraded", checks: { database: "failed" } };
    }
    return reply.status(body.status === "ok" ? 200 : 503).send(HealthDtoSchema.parse(body));
  });
}
