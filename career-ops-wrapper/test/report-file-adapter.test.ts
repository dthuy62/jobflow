import { writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listReportFiles } from "../src/workspace/report-file-adapter.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];

afterEach(async () => {
  await removeWorkspaces(workspaces);
});

describe("listReportFiles", () => {
  it("lists numbered Markdown reports with parsed headers", async () => {
    const reports = await listReportFiles(projectionFixturePath);

    expect(reports.map((report) => [report.id, report.fileName])).toEqual([
      ["report_001", "001-acme-robotics-2026-06-20.md"],
      ["report_002", "002-globex-labs-2026-06-21.md"],
      ["report_003", "003-umbrella-mobile.md"]
    ]);
    expect(reports[0]?.header).toMatchObject({
      kind: "evaluation",
      title: "Acme Robotics — Senior Android Engineer",
      pdfFileName: "cv-jane-doe-acme-robotics-2026-06-20.pdf"
    });
    expect(reports[0]?.fileDate).toBe("2026-06-20");
    expect(reports[2]?.header.kind).toBe("unknown");
    expect(reports[0]?.markdown).toContain("## A) Role Summary");
  });

  it("keeps the first file when two reports share a number", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(path.join(workspace, "reports/001-zzz-duplicate.md"), "# Evaluation: Dup — Role\n");

    const reports = await listReportFiles(workspace);

    expect(reports.filter((report) => report.id === "report_001")).toHaveLength(1);
    expect(reports.find((report) => report.id === "report_001")?.fileName).toBe(
      "001-acme-robotics-2026-06-20.md"
    );
  });

  it("marks reports over 1 MiB as too large instead of reading them", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(path.join(workspace, "reports/009-huge.md"), "x".repeat(1024 * 1024 + 1));

    const huge = (await listReportFiles(workspace)).find((report) => report.id === "report_009");

    expect(huge?.markdown).toBeUndefined();
    expect(huge?.tooLarge).toBe(true);
  });
});
