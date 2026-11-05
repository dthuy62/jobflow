// Synthetic stand-in for Career Ops `reserve-report-num.mjs` (test fixture).
// Same CLI contract: prints the next number padded to at least three digits
// and creates `reports/NNN-RESERVED.md`; `--release NNN` deletes it.
import { existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const reports = join(dirname(fileURLToPath(import.meta.url)), "reports");
const pad = (n) => String(n).padStart(3, "0");
const [, , command, value] = process.argv;

if (command === "--release") {
  if (!/^\d{1,3}$/.test(value ?? "")) {
    process.stderr.write("Usage: node reserve-report-num.mjs --release <NNN>\n");
    process.exit(1);
  }
  const sentinel = join(reports, `${pad(Number(value))}-RESERVED.md`);
  if (existsSync(sentinel)) unlinkSync(sentinel);
  process.exit(0);
}

let next = 1;
for (const name of readdirSync(reports)) {
  const match = name.match(/^(\d{3,})-/);
  if (match) next = Math.max(next, Number(match[1]) + 1);
}
writeFileSync(join(reports, `${pad(next)}-RESERVED.md`), "", { flag: "wx" });
process.stdout.write(`${pad(next)}\n`);
