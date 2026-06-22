export interface CliArgs {
  readonly host?: string;
  readonly port?: number;
  readonly workspace?: string;
}

export function parsePort(value: string, source: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${source} must be an integer between 1 and 65535.`);
  }

  const port = Number.parseInt(value, 10);

  if (port < 1 || port > 65535) {
    throw new Error(`${source} must be an integer between 1 and 65535.`);
  }

  return port;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--host") {
      const next = requireFlagValue(argv, index, current);
      Object.assign(args, { host: next });
      index += 1;
    } else if (current === "--port") {
      const next = requireFlagValue(argv, index, current);
      Object.assign(args, { port: parsePort(next, "--port") });
      index += 1;
    } else if (current === "--workspace") {
      const next = requireFlagValue(argv, index, current);
      Object.assign(args, { workspace: next });
      index += 1;
    }
  }

  return args;
}

function requireFlagValue(argv: readonly string[], index: number, flag: string): string {
  const next = argv[index + 1];

  if (!next || next.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return next;
}
