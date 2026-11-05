import { parseCliArgs } from "./cli-args.js";
import { loadEnvConfig, type EvaluationProvider } from "./env.js";

export interface EvaluationConfig {
  readonly provider: EvaluationProvider;
  readonly timeoutMs: number;
  /** Absolute CLI path; resolved from `PATH` when absent. */
  readonly cliPath?: string;
}

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly workspace: string;
  readonly pairingToken?: string;
  /** Scan run timeout; defaults to {@link DEFAULT_SCAN_TIMEOUT_MS}. */
  readonly scanTimeoutMs?: number;
  /** AI offer evaluation; absent when no provider is configured (disabled). */
  readonly evaluation?: EvaluationConfig;
}

export const DEFAULT_SCAN_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_EVALUATION_TIMEOUT_MS = 15 * 60 * 1000;

export interface LoadRuntimeConfigOptions {
  readonly argv?: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
}

export function loadRuntimeConfig(options: LoadRuntimeConfigOptions = {}): RuntimeConfig {
  const envConfig = loadEnvConfig(options.env);
  const cliArgs = parseCliArgs(options.argv ?? process.argv.slice(2));
  const cwd = options.cwd ?? process.cwd();

  const config: RuntimeConfig = {
    host: cliArgs.host ?? envConfig.host ?? "127.0.0.1",
    port: cliArgs.port ?? envConfig.port ?? 3000,
    workspace: cliArgs.workspace ?? cwd
  };

  if (envConfig.pairingToken) {
    Object.assign(config, { pairingToken: envConfig.pairingToken });
  }

  if (envConfig.scanTimeoutMs) {
    Object.assign(config, { scanTimeoutMs: envConfig.scanTimeoutMs });
  }

  if (envConfig.evaluationProvider) {
    Object.assign(config, {
      evaluation: {
        provider: envConfig.evaluationProvider,
        timeoutMs: envConfig.evaluationTimeoutMs ?? DEFAULT_EVALUATION_TIMEOUT_MS,
        ...(envConfig.evaluationCliPath ? { cliPath: envConfig.evaluationCliPath } : {})
      }
    });
  }

  return config;
}
