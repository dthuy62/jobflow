import { describe, expect, it } from "vitest";
import {
  normalizeOfferUrl,
  offerIdForTrackerNumber,
  offerIdForUrl,
  parseApplications,
  parsePipeline,
  parseReportHeader,
  parseScanHistory,
  parseScanOutput,
  parseScoreToPercent
} from "../src/parsers/index.js";

describe("parseScoreToPercent", () => {
  it.each([
    ["4.2/5", 84],
    ["5/5", 100],
    ["0/5", 0],
    ["3.15/5", 63],
    [" 3.1 / 5 ", 62],
    ["**4.5/5**", 90]
  ])("maps %s to %d", (text, expected) => {
    expect(parseScoreToPercent(text)).toBe(expected);
  });

  it.each([undefined, "", "N/A", "7/5", "-1/5", "4.2/10", "abc"])("returns null for %s", (text) => {
    expect(parseScoreToPercent(text)).toBeNull();
  });
});

describe("offer URL identity", () => {
  it("normalizes scheme/host case, fragment and trailing slash", () => {
    expect(normalizeOfferUrl(" HTTPS://Jobs.Example.com/a/b/?x=1#apply ")).toBe(
      "https://jobs.example.com/a/b?x=1"
    );
    expect(normalizeOfferUrl("https://jobs.example.com/")).toBe("https://jobs.example.com/");
  });

  it("rejects non-HTTP URLs", () => {
    expect(normalizeOfferUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeOfferUrl("/Users/someone/file")).toBeUndefined();
    expect(normalizeOfferUrl("not a url")).toBeUndefined();
  });

  it("derives stable opaque ids", () => {
    const id = offerIdForUrl("https://jobs.example.com/a");
    expect(id).toMatch(/^offer_[a-f0-9]{16}$/);
    expect(offerIdForUrl("https://jobs.example.com/a")).toBe(id);
    expect(offerIdForTrackerNumber("3")).toMatch(/^offer_[a-f0-9]{16}$/);
    expect(offerIdForTrackerNumber("3")).not.toBe(id);
  });
});

describe("parseScanHistory", () => {
  it("parses rows by header and tolerates 6-column legacy rows", () => {
    const rows = parseScanHistory(
      "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n" +
        "https://a.example/1\t2026-06-18\tgreenhouse-api\tAndroid Dev\tAcme\tadded\tRemote\n" +
        "https://a.example/2\t2026-06-19\tlever\tiOS Dev\tGlobex\tskipped_expired\n" +
        "\n"
    );

    expect(rows).toEqual([
      {
        url: "https://a.example/1",
        firstSeen: "2026-06-18",
        portal: "greenhouse-api",
        title: "Android Dev",
        company: "Acme",
        status: "added",
        location: "Remote"
      },
      {
        url: "https://a.example/2",
        firstSeen: "2026-06-19",
        portal: "lever",
        title: "iOS Dev",
        company: "Globex",
        status: "skipped_expired",
        location: ""
      }
    ]);
  });

  it("defaults a missing status to added", () => {
    const [row] = parseScanHistory("url\tfirst_seen\tportal\ttitle\tcompany\nhttps://a.example/1\t2026-06-18\tp\tT\tC\n");
    expect(row?.status).toBe("added");
  });
});

describe("parsePipeline", () => {
  it.each([
    ["## Pendientes", "## Procesadas"],
    ["## Pending", "## Processed"]
  ])("parses %s and %s sections", (pendingHeader, processedHeader) => {
    const result = parsePipeline(
      [
        "# Pipeline",
        "",
        pendingHeader,
        "",
        "- [ ] https://a.example/1 | Hooli | Kotlin Developer",
        "- [ ] https://a.example/2",
        "",
        processedHeader,
        "",
        "- [x] #004 | https://a.example/3 | Acme | Senior Android | 4.2/5 | PDF ✅",
        "- [x] https://a.example/4 | Globex | Mobile"
      ].join("\n")
    );

    expect(result.pending).toEqual([
      { url: "https://a.example/1", company: "Hooli", title: "Kotlin Developer" },
      { url: "https://a.example/2" }
    ]);
    expect(result.processed).toEqual([
      {
        url: "https://a.example/3",
        company: "Acme",
        title: "Senior Android",
        reportNumber: "004",
        scoreText: "4.2/5"
      },
      { url: "https://a.example/4", company: "Globex", title: "Mobile" }
    ]);
  });

  it("treats checked lines as processed even outside a section", () => {
    const result = parsePipeline("- [x] #7 | https://a.example/9 | Co | Role | 3/5 | PDF ❌\n");
    expect(result.processed[0]?.reportNumber).toBe("007");
  });
});

describe("parseApplications", () => {
  it("locates columns by header name, with or without Notes", () => {
    const rows = parseApplications(
      [
        "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |",
        "|---|------|---------|------|-------|--------|-----|--------|-------|",
        "| 1 | 2026-06-20 | Acme | Senior Android | 4.2/5 | Evaluated | ✅ | [001](../reports/001-acme-2026-06-20.md) | Good fit |",
        "| 3 | 2026-06-22 | Initech | Staff Mobile | 2.0/5 | SKIP | ❌ |  |  |"
      ].join("\n")
    );

    expect(rows).toEqual([
      {
        number: "1",
        date: "2026-06-20",
        company: "Acme",
        role: "Senior Android",
        scoreText: "4.2/5",
        status: "Evaluated",
        reportNumber: "001",
        notes: "Good fit"
      },
      {
        number: "3",
        date: "2026-06-22",
        company: "Initech",
        role: "Staff Mobile",
        scoreText: "2.0/5",
        status: "SKIP"
      }
    ]);

    const withoutNotes = parseApplications(
      "| Report | Status | # | Company | Role |\n|--|--|--|--|--|\n| [12](../reports/012-x.md) | Applied | 12 | X | Y |\n"
    );
    expect(withoutNotes).toEqual([
      { number: "12", company: "X", role: "Y", status: "Applied", reportNumber: "012" }
    ]);
  });

  it("returns no rows when the table is missing", () => {
    expect(parseApplications("# Applications\n\nNothing yet.\n")).toEqual([]);
  });
});

describe("parseReportHeader", () => {
  it("reads the evaluation header fields", () => {
    expect(
      parseReportHeader(
        [
          "# Evaluation: Acme Robotics — Senior Android Engineer",
          "",
          "**Date:** 2026-06-20",
          "**URL:** https://jobs.example.com/acme",
          "**Score:** 4.2/5",
          "**PDF:** output/cv-jane-doe-acme-2026-06-20.pdf",
          "",
          "## A) Role Summary"
        ].join("\n")
      )
    ).toEqual({
      title: "Acme Robotics — Senior Android Engineer",
      kind: "evaluation",
      date: "2026-06-20",
      url: "https://jobs.example.com/acme",
      scoreText: "4.2/5",
      pdfFileName: "cv-jane-doe-acme-2026-06-20.pdf"
    });
  });

  it("accepts the Spanish evaluation heading", () => {
    expect(parseReportHeader("# Evaluación: Acme — Rol\n")).toEqual({ title: "Acme — Rol", kind: "evaluation" });
  });

  it("ignores PDF values that are not output PDFs and non-evaluation headings", () => {
    expect(
      parseReportHeader("# Interview notes\n\n**PDF:** not generated — score below threshold\n")
    ).toEqual({ title: "Interview notes", kind: "unknown" });
    expect(parseReportHeader("**PDF:** output/../secret.pdf\n").pdfFileName).toBeUndefined();
  });
});

describe("parseScanOutput", () => {
  it("extracts counts and error warnings", () => {
    const output = [
      "Portal Scan — 2026-10-30",
      "Total jobs found:      14",
      "Duplicates:            2 skipped",
      "New offers added:      3",
      "Agent/WebSearch handoff: 2 companies not handled by zero-token providers",
      "  • Initech (websearch)",
      "",
      "Errors (2):",
      "  ✗ Globex Labs: HTTP 503",
      "  ✗ Hooli: timeout",
      "",
      "New offers:",
      "  + Acme | Android | Remote"
    ].join("\n");

    expect(parseScanOutput(output)).toEqual({
      offersFound: 14,
      offersAdded: 3,
      warnings: [
        "Agent/WebSearch handoff: 2 companies not handled by zero-token providers",
        "Globex Labs: HTTP 503",
        "Hooli: timeout"
      ]
    });
  });

  it("defaults missing counts to zero", () => {
    expect(parseScanOutput("")).toEqual({ offersFound: 0, offersAdded: 0, warnings: [] });
  });
});
