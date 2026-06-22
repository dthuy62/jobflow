import { parseCliArgs } from "./cli-args.js";
import { loadEnvConfig } from "./env.js";

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly workspace: string;
  readonly pairingToken?: string;
}

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

  return config;
}
