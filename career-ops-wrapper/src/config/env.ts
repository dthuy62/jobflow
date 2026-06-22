import "dotenv/config";
import { parsePort } from "./cli-args.js";

export interface EnvConfig {
  readonly host?: string;
  readonly port?: number;
  readonly pairingToken?: string;
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

  return config;
}
