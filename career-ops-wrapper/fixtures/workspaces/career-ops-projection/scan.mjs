// Synthetic, deterministic stand-in for Career Ops scan.mjs. No network access.
// Prints the same summary lines the real scanner prints.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const companyIndex = args.indexOf("--company");
const company = companyIndex === -1 ? null : args[companyIndex + 1];

const found = [
  { url: "https://jobs.example.com/umbrella-mobile/android-lead", company: "Umbrella Mobile", title: "Android Lead", location: "Remote" }
].filter((offer) => !company || offer.company.toLowerCase() === company.toLowerCase());

const historyPath = "data/scan-history.tsv";
const pipelinePath = "data/pipeline.md";
const known = existsSync(historyPath) ? readFileSync(historyPath, "utf8") : "";
const fresh = found.filter((offer) => !known.includes(offer.url));

if (!dryRun && fresh.length > 0) {
  appendFileSync(
    historyPath,
    fresh.map((o) => [o.url, "2026-10-30", "fixture-provider", o.title, o.company, "added", o.location].join("\t")).join("\n") + "\n"
  );
  const pipeline = readFileSync(pipelinePath, "utf8");
  const marker = "## Pendientes";
  const at = pipeline.indexOf("\n## ", pipeline.indexOf(marker) + marker.length);
  const block = "\n" + fresh.map((o) => `- [ ] ${o.url} | ${o.company} | ${o.title}`).join("\n") + "\n";
  writeFileSync(pipelinePath, at === -1 ? pipeline + block : pipeline.slice(0, at) + block + pipeline.slice(at));
}

console.log("Portal Scan — 2026-10-30");
console.log(`Companies scanned:     ${company ? 1 : 2}`);
console.log(`Total jobs found:      ${found.length + 3}`);
console.log("Filtered by title:     2 removed");
console.log(`Duplicates:            ${found.length - fresh.length + 1} skipped`);
console.log(`New offers added:      ${fresh.length}`);
console.log("");
console.log("Errors (1):");
console.log("  ✗ Globex Labs: HTTP 503 from careers page");
if (dryRun) console.log("\n(dry run — run without --dry-run to save results)");
