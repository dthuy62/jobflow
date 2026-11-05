import type { Pool } from "pg";
import type { DeviceRepository } from "../core/ports.js";

export function createPgDeviceRepository(pool: Pick<Pool, "query">): DeviceRepository {
  return {
    async remove(userId, installationId) {
      await pool.query("DELETE FROM devices WHERE user_id = $1 AND installation_id = $2", [userId, installationId]);
    }
  };
}
