import "dotenv/config";
import path from "node:path";
import { parsePort } from "./cli-args.js";

export const EVALUATION_PROVIDERS = ["claude"] as const;
export type EvaluationProvider = (typeof EVALUATION_PROVIDERS)[number];

export interface EnvConfig {
  readonly host?: string;
  readonly port?: number;
  readonly pairingToken?: string;
  readonly scanTimeoutMs?: number;
  readonly evaluationProvider?: EvaluationProvider;
  readonly evaluationTimeoutMs?: number;
  readonly evaluationCliPath?: string;
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

  if (env.CAREER_OPS_EVALUATION_PROVIDER) {
    Object.assign(config, { evaluationProvider: parseEvaluationProvider(env.CAREER_OPS_EVALUATION_PROVIDER) });
  }

  if (env.CAREER_OPS_EVALUATION_TIMEOUT_MS) {
    Object.assign(config, {
      evaluationTimeoutMs: parseEvaluationTimeoutMs(env.CAREER_OPS_EVALUATION_TIMEOUT_MS)
    });
  }

  if (env.CAREER_OPS_EVALUATION_CLI) {
    Object.assign(config, { evaluationCliPath: parseEvaluationCliPath(env.CAREER_OPS_EVALUATION_CLI) });
  }

  return config;
}

export function parseEvaluationProvider(value: string): EvaluationProvider {
  const provider = EVALUATION_PROVIDERS.find((candidate) => candidate === value);
  if (!provider) {
    throw new Error('CAREER_OPS_EVALUATION_PROVIDER must be "claude".');
  }
  return provider;
}

export function parseEvaluationTimeoutMs(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 60_000 || Number(value) > 3_600_000) {
    throw new Error("CAREER_OPS_EVALUATION_TIMEOUT_MS must be an integer between 60000 and 3600000.");
  }

  return Number(value);
}

export function parseEvaluationCliPath(value: string): string {
  if (!path.isAbsolute(value)) {
    throw new Error("CAREER_OPS_EVALUATION_CLI must be an absolute path.");
  }

  return value;
}

export function parseScanTimeoutMs(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1000 || Number(value) > 3_600_000) {
    throw new Error("CAREER_OPS_SCAN_TIMEOUT_MS must be an integer between 1000 and 3600000.");
  }

  return Number(value);
}
