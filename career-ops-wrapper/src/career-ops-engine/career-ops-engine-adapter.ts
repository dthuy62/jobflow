export interface RunScanInput {
  readonly requestedAt: string;
}

export interface RunScanResult {
  readonly scanRunId: string;
  readonly startedAt: string;
}

export interface CareerOpsEngineAdapter {
  runScan(input: RunScanInput): Promise<RunScanResult>;
}
