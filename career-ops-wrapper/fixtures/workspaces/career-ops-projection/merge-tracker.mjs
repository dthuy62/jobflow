// Synthetic stand-in for Career Ops `merge-tracker.mjs` (test fixture).
// Merges 9-column TSV lines from CAREER_OPS_ADDITIONS (default
// batch/tracker-additions) into data/applications.md and prints the same
// "➕ Add" / "⏭️  Skip" / "🔄 Update" lines as the real script.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const tracker = join(root, "data/applications.md");
const additions = process.env.CAREER_OPS_ADDITIONS ?? join(root, "batch/tracker-additions");

if (!existsSync(tracker)) {
  console.log("No applications.md found. Nothing to merge into.");
  process.exit(0);
}
const lines = readFileSync(tracker, "utf8").replace(/\n+$/, "").split("\n");
const rows = lines.filter((line) => /^\|\s*\d+\s*\|/.test(line)).map((line) => line.split("|").map((cell) => cell.trim()));
let max = Math.max(0, ...rows.map((cells) => Number(cells[1])));
const files = existsSync(additions) ? readdirSync(additions).filter((name) => name.endsWith(".tsv")) : [];

for (const file of files) {
  const [num, date, company, role, status, score, pdf, report, notes = ""] = readFileSync(join(additions, file), "utf8")
    .trim()
    .split("\t");
  const duplicate = rows.find((cells) => cells[3]?.toLowerCase() === company.toLowerCase() && cells[4]?.toLowerCase() === role.toLowerCase());
  if (duplicate) {
    if (parseFloat(duplicate[5]) >= parseFloat(score)) {
      console.log(`⏭️  Skip: ${company} — ${role} (existing #${duplicate[1]})`);
    } else {
      console.log(`🔄 Update: #${duplicate[1]} ${company} — ${role}`);
    }
    continue;
  }
  const entry = Number(num) > max ? Number(num) : ++max;
  max = Math.max(max, entry);
  lines.push(`| ${entry} | ${date} | ${company} | ${role} | ${score} | ${status} | ${pdf} | ${report.replace("](reports/", "](../reports/")} | ${notes} |`);
  console.log(`➕ Add #${entry}: ${company} — ${role} (${score})`);
}
writeFileSync(tracker, `${lines.join("\n")}\n`);
mkdirSync(join(additions, "merged"), { recursive: true });
for (const file of files) renameSync(join(additions, file), join(additions, "merged", file));
