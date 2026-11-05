import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OfferDtoSchema } from "../src/contracts/index.js";
import { artifactIdForFileName } from "../src/outputs/index.js";
import { normalizeOfferUrl, offerIdForTrackerNumber, offerIdForUrl } from "../src/parsers/index.js";
import { createOfferService } from "../src/services/offer-service.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];

afterEach(async () => {
  await removeWorkspaces(workspaces);
});

function serviceFor(workspace: string) {
  return createOfferService({ host: "127.0.0.1", port: 3000, workspace });
}

const urlId = (url: string) => offerIdForUrl(normalizeOfferUrl(url) as string);

describe("offer service", () => {
  it("merges scan history, pipeline, tracker and reports by URL", async () => {
    const collection = await serviceFor(projectionFixturePath).listOffers();

    expect(collection.sourceRevision).toMatch(/^offers_sha256_[a-f0-9]{8}$/);
    expect(collection.items.map((offer) => [offer.company, offer.status])).toEqual([
      ["Vandelay Industries", "new"],
      ["Hooli", "new"],
      ["Initech", "archived"],
      ["Globex Labs", "applied"],
      ["Acme Robotics", "tracked"]
    ]);
    for (const offer of collection.items) {
      expect(() => OfferDtoSchema.parse(offer)).not.toThrow();
    }
  });

  it("projects an evaluated tracker offer with score, report and PDF links", async () => {
    const offer = await serviceFor(projectionFixturePath).getOffer(
      urlId("https://jobs.example.com/acme-robotics/senior-android")
    );

    expect(offer).toMatchObject({
      company: "Acme Robotics",
      title: "Senior Android Engineer",
      url: "https://jobs.example.com/acme-robotics/senior-android",
      location: "Remote (EU)",
      source: "greenhouse-api",
      status: "tracked",
      evaluationStatus: "evaluated",
      score: 84,
      reportId: "report_001",
      artifactIds: [artifactIdForFileName("cv-jane-doe-acme-robotics-2026-06-20.pdf")],
      firstSeenAt: "2026-06-18T00:00:00.000Z",
      lastSeenAt: null,
      scanRunId: null,
      workMode: "remote",
      notes: "Strong platform match",
      rawSource: "scan-history, pipeline, tracker, report"
    });
  });

  it("shows scan-only offers as not evaluated yet", async () => {
    const offer = await serviceFor(projectionFixturePath).getOffer(
      urlId("https://jobs.example.com/hooli/kotlin-dev")
    );

    expect(offer).toMatchObject({
      status: "new",
      evaluationStatus: "notEvaluated",
      score: null,
      reportId: null,
      artifactIds: [],
      url: "https://jobs.example.com/hooli/kotlin-dev",
      workMode: "unknown"
    });
  });

  it("keeps a tracker row without a resolvable URL as its own offer", async () => {
    const offer = await serviceFor(projectionFixturePath).getOffer(offerIdForTrackerNumber("3"));

    expect(offer).toMatchObject({
      company: "Initech",
      title: "Staff Mobile Engineer",
      url: null,
      status: "archived",
      score: 40,
      reportId: null,
      firstSeenAt: "2026-06-22T00:00:00.000Z",
      source: "career-ops"
    });
  });

  it("excludes scan-history rows that never reached the pipeline", async () => {
    const collection = await serviceFor(projectionFixturePath).listOffers();

    expect(collection.items.some((offer) => offer.company === "Defunct Corp")).toBe(false);
  });

  it("returns NOT_FOUND for unknown offers", async () => {
    await expect(serviceFor(projectionFixturePath).getOffer("offer_0000000000000000")).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
  });

  it("returns an empty list for a workspace without Career Ops data files", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "offers-empty-"));
    workspaces.push(workspace);

    const collection = await serviceFor(workspace).listOffers();

    expect(collection.items).toEqual([]);
  });

  it("drops path-like text with a warning instead of failing the list", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(
      path.join(workspace, "data/applications.md"),
      [
        "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |",
        "|---|---|---|---|---|---|---|---|---|",
        "| 9 | 2026-07-01 | /Users/jane/secret | Role | 3/5 | Evaluated | ❌ | | see ../../etc/passwd |"
      ].join("\n")
    );

    const offer = await serviceFor(workspace).getOffer(offerIdForTrackerNumber("9"));

    expect(offer.company).toBe("Unknown company");
    expect(offer.notes).toBeNull();
    expect(offer.warnings).toEqual(["company omitted: it looked like a local path.", "notes omitted: it looked like a local path."]);
    expect(JSON.stringify(offer)).not.toContain("/Users/jane");
  });

  it("falls back without a path warning when a report heading has an empty company", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(
      path.join(workspace, "reports/007-blank-2026-07-01.md"),
      "# Evaluation: — Lonely Role\n\n**URL:** https://jobs.example.com/blank/role\n"
    );

    const offer = await serviceFor(workspace).getOffer(urlId("https://jobs.example.com/blank/role"));

    expect(offer).toMatchObject({ company: "Unknown company", title: "Lonely Role", warnings: [] });
  });

  it("treats impossible calendar dates as missing with a warning", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "offers-dates-"));
    workspaces.push(workspace);
    await mkdir(path.join(workspace, "data"));
    await writeFile(
      path.join(workspace, "data/applications.md"),
      "| # | Date | Company | Role | Status |\n|---|---|---|---|---|\n| 1 | 2026-06-31 | Co | Role | Evaluated |\n"
    );
    await writeFile(
      path.join(workspace, "data/scan-history.tsv"),
      "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\nhttps://jobs.example.com/x\t2026-02-30\tp\tT\tC\tadded\t\n"
    );

    const service = serviceFor(workspace);
    const collection = await service.listOffers();
    const tracker = await service.getOffer(offerIdForTrackerNumber("1"));
    const scanned = await service.getOffer(urlId("https://jobs.example.com/x"));

    expect(collection.items).toHaveLength(2);
    expect(tracker).toMatchObject({
      firstSeenAt: null,
      warnings: ["firstSeenAt omitted: 2026-06-31 is not a calendar date."]
    });
    expect(scanned).toMatchObject({
      firstSeenAt: null,
      warnings: ["firstSeenAt omitted: 2026-02-30 is not a calendar date."]
    });
  });

  it("marks an offer known only from an evaluation report as tracked", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "offers-report-only-"));
    workspaces.push(workspace);
    await mkdir(path.join(workspace, "reports"));
    await writeFile(
      path.join(workspace, "reports/004-solo-2026-07-01.md"),
      "# Evaluation: Solo Co — Android Lead\n\n**URL:** https://jobs.example.com/solo/android\n**Score:** 4/5\n"
    );

    const offer = await serviceFor(workspace).getOffer(urlId("https://jobs.example.com/solo/android"));

    expect(offer).toMatchObject({
      company: "Solo Co",
      title: "Android Lead",
      status: "tracked",
      evaluationStatus: "evaluated",
      reportId: "report_004",
      rawSource: "report"
    });
  });

  it("marks a scanned offer with an evaluation report as tracked when no tracker row exists", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(
      path.join(workspace, "reports/004-hooli-2026-07-01.md"),
      "# Evaluation: Hooli — Kotlin Developer\n\n**URL:** https://jobs.example.com/hooli/kotlin-dev\n"
    );

    const offer = await serviceFor(workspace).getOffer(urlId("https://jobs.example.com/hooli/kotlin-dev"));

    expect(offer).toMatchObject({ status: "tracked", evaluationStatus: "evaluated", reportId: "report_004" });
  });

  it.each([
    ["Evaluated", "tracked"],
    ["evaluada", "tracked"],
    ["Applied", "applied"],
    ["Interview", "applied"],
    ["Offer", "applied"],
    ["Responded", "applied"],
    ["Rejected", "rejected"],
    ["Discarded", "archived"],
    ["SKIP", "archived"],
    ["**Applied**", "applied"],
    ["Mystery", "unknown"]
  ])("maps tracker status %s to %s", async (trackerStatus, expected) => {
    const workspace = await mkdtemp(path.join(tmpdir(), "offers-status-"));
    workspaces.push(workspace);
    await mkdir(path.join(workspace, "data"));
    await writeFile(
      path.join(workspace, "data/applications.md"),
      `| # | Date | Company | Role | Status |\n|---|---|---|---|---|\n| 1 | 2026-07-01 | Co | Role | ${trackerStatus} |\n`
    );

    const offer = await serviceFor(workspace).getOffer(offerIdForTrackerNumber("1"));

    expect(offer.status).toBe(expected);
  });
});
