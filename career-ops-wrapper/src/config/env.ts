import "dotenv/config";
import { parsePort } from "./cli-args.js";

export interface EnvConfig {
  readonly host?: string;
  readonly port?: number;
  readonly pairingToken?: string;
  readonly scanTimeoutMs?: number;
}

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const port = env.CAREER_OPS_PORT
    ? parsePort(env.CAREER_OPS_PORT, "CAREER_OPS_PORT")
    : undefined;

  const config: EnvConfig = {};

  if (env.CAREER_OPS_HOST) {
    Object.assign(config, { host: env.CAREER_OPS_HOST });
  }

  if (port) {
    Object.assign(config, { port });
  }

  if (env.CAREER_OPS_PAIRING_TOKEN) {
    Object.assign(config, { pairingToken: env.CAREER_OPS_PAIRING_TOKEN });
  }

  if (env.CAREER_OPS_SCAN_TIMEOUT_MS) {
    Object.assign(config, { scanTimeoutMs: parseScanTimeoutMs(env.CAREER_OPS_SCAN_TIMEOUT_MS) });
  }

  return config;
}

export function parseScanTimeoutMs(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1000 || Number(value) > 3_600_000) {
    throw new Error("CAREER_OPS_SCAN_TIMEOUT_MS must be an integer between 1000 and 3600000.");
  }

  return Number(value);
}
