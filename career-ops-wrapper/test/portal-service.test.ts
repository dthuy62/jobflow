import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { PortalDtoSchema } from "../src/contracts/index.js";
import { ApiError } from "../src/errors/api-error.js";
import { createPortalService } from "../src/services/portal-service.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-portal-service-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

function configFor(workspace: string): RuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    workspace
  };
}

const portalYaml = `title_filter:
  positive: ["Flutter", "Mobile"]
  negative: ["Intern"]
location_filter:
  always_allow: ["Da Nang", "Viet Nam"]
  allow: ["Remote", "Viet Nam"]
  block: ["India"]
salary_filter:
  min: 100000
  max: 0
  currency: "usd"
tracked_companies:
  - name: OpenAI
    careers_url: https://openai.com/careers
    provider: websearch
    enabled: true
    ignored: must-not-leak
  - name: Anthropic
    careers_url: https://job-boards.greenhouse.io/anthropic
    enabled: false
search_queries:
  - name: Greenhouse Flutter
    query: "site:boards.greenhouse.io Flutter"
    enabled: true
unknown_top_level: "must not leak"
`;

const saveRequest = {
  titlePositiveKeywords: ["Android", "Kotlin"],
  titleNegativeKeywords: ["Intern"],
  locationAllowList: ["Da Nang", "Remote", "Singapore"],
  locationBlockList: ["India"],
  salaryMin: 120000,
  salaryMax: 220000,
  salaryCurrency: "USD",
  trackedCompanies: [
    {
      name: "OpenAI",
      careersUrl: "https://openai.com/careers",
      provider: "websearch",
      enabled: false
    }
  ],
  searchQueries: [
    {
      id: "query_greenhouse_flutter",
      label: "Greenhouse Android",
      query: "site:boards.greenhouse.io Android",
      enabled: true
    }
  ]
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Portal service", () => {
  it("normalizes real Career Ops portal YAML into PortalDto fields", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "portals.yml"), portalYaml);

    const portal = await createPortalService(configFor(workspace)).getPortals();

    expect(PortalDtoSchema.parse(portal)).toMatchObject({
      titlePositiveKeywords: ["Flutter", "Mobile"],
      titleNegativeKeywords: ["Intern"],
      locationAllowList: ["Da Nang", "Viet Nam", "Remote"],
      locationBlockList: ["India"],
      salaryMin: 100000,
      salaryCurrency: "USD",
      trackedCompanies: [
        {
          name: "OpenAI",
          careersUrl: "https://openai.com/careers",
          provider: "websearch",
          enabled: true
        },
        {
          name: "Anthropic",
          careersUrl: "https://job-boards.greenhouse.io/anthropic",
          enabled: false
        }
      ],
      searchQueries: [
        {
          label: "Greenhouse Flutter",
          query: "site:boards.greenhouse.io Flutter",
          enabled: true
        }
      ]
    });
    expect(portal.salaryMax).toBeUndefined();
    expect(portal.trackedCompanies[0]?.id).toMatch(/^company_[a-f0-9]{8}$/);
    expect(portal.searchQueries[0]?.id).toMatch(/^query_[a-f0-9]{8}$/);
    expect(portal.sourceRevision).toMatch(/^portals_sha256_[a-f0-9]{8}$/);
    expect(JSON.stringify(portal)).not.toContain("unknown_top_level");
    expect(JSON.stringify(portal)).not.toContain("ignored");
    await expect(readFile(path.join(workspace, "portals.yml"), "utf8")).resolves.toBe(portalYaml);
  });

  it("deduplicates location allow-list entries after trimming", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(
      path.join(workspace, "portals.yml"),
      `location_filter:
  always_allow: ["Remote"]
  allow: [" Remote "]
`
    );

    await expect(createPortalService(configFor(workspace)).getPortals()).resolves.toMatchObject({
      locationAllowList: ["Remote"]
    });
  });

  it("rejects malformed parent sections instead of treating them as absent", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(
      path.join(workspace, "portals.yml"),
      `title_filter: invalid
location_filter: []
salary_filter: invalid
`
    );

    await expect(createPortalService(configFor(workspace)).getPortals()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });

  it("rejects malformed optional company and query fields", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(
      path.join(workspace, "portals.yml"),
      `tracked_companies:
  - id: 123
    name: OpenAI
    careers_url: https://openai.com/careers
    provider: 123
    enabled: true
search_queries:
  - id: 456
    name: Search
    query: mobile
    enabled: true
`
    );

    await expect(createPortalService(configFor(workspace)).getPortals()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });

  it("rejects malformed company and query entries", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(
      path.join(workspace, "portals.yml"),
      `tracked_companies:
  - name: OpenAI
    careers_url: not-a-url
search_queries:
  - name: ""
    query: ok
`
    );

    await expect(createPortalService(configFor(workspace)).getPortals()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });

  it("saves editable portal fields while preserving unknown YAML keys", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writeFile(
      portalPath,
      `title_filter:
  positive: ["Flutter"]
  negative: ["Intern"]
location_filter:
  always_allow: ["Da Nang"]
  allow: ["Remote"]
  block: ["India"]
salary_filter:
  min: 100000
  max: 0
  currency: usd
tracked_companies:
  - name: OpenAI
    careers_url: https://openai.com/careers
    provider: websearch
    enabled: true
    parser: keep-me
search_queries:
  - id: query_greenhouse_flutter
    name: Greenhouse Flutter
    query: "site:boards.greenhouse.io Flutter"
    enabled: true
    region: us
unknown_top_level: keep-me
`
    );

    const saved = await createPortalService(configFor(workspace)).savePortals(saveRequest);
    const parsed = loadYaml(await readFile(portalPath, "utf8")) as Record<string, unknown>;

    expect(saved).toMatchObject({
      titlePositiveKeywords: ["Android", "Kotlin"],
      locationAllowList: ["Da Nang", "Remote", "Singapore"],
      salaryMin: 120000,
      salaryMax: 220000,
      salaryCurrency: "USD",
      trackedCompanies: [{ name: "OpenAI", enabled: false }],
      searchQueries: [{ label: "Greenhouse Android" }]
    });
    expect(saved.sourceRevision).toMatch(/^portals_sha256_[a-f0-9]{8}$/);
    expect(parsed).toMatchObject({
      title_filter: {
        positive: ["Android", "Kotlin"],
        negative: ["Intern"]
      },
      location_filter: {
        always_allow: ["Da Nang"],
        allow: ["Remote", "Singapore"],
        block: ["India"]
      },
      salary_filter: {
        min: 120000,
        max: 220000,
        currency: "USD"
      },
      tracked_companies: [
        {
          name: "OpenAI",
          careers_url: "https://openai.com/careers",
          enabled: false,
          parser: "keep-me"
        }
      ],
      search_queries: [
        {
          name: "Greenhouse Android",
          query: "site:boards.greenhouse.io Android",
          enabled: true,
          id: "query_greenhouse_flutter",
          region: "us"
        }
      ],
      unknown_top_level: "keep-me"
    });
    expect(JSON.stringify(parsed)).not.toContain("company_");
  });

  it("rejects invalid save requests without modifying portal YAML", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writeFile(portalPath, portalYaml);

    await expect(
      createPortalService(configFor(workspace)).savePortals({
        ...saveRequest,
        trackedCompanies: [{ ...saveRequest.trackedCompanies[0], careersUrl: "not-a-url" }]
      } as never)
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(readFile(portalPath, "utf8")).resolves.toBe(portalYaml);
  });

  it("creates a minimal portal config when none exists", async () => {
    const workspace = await createTempWorkspace();

    const saved = await createPortalService(configFor(workspace)).savePortals(saveRequest);

    expect(saved).toMatchObject({
      titlePositiveKeywords: ["Android", "Kotlin"],
      trackedCompanies: [{ name: "OpenAI" }],
      searchQueries: [{ label: "Greenhouse Android" }]
    });
    await expect(readFile(path.join(workspace, "portals.yml"), "utf8")).resolves.toContain(
      "Greenhouse Android"
    );
  });

  it("rejects malformed existing portal YAML instead of overwriting it", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    const yaml = "title_filter: [";
    await writeFile(portalPath, yaml);

    await expect(createPortalService(configFor(workspace)).savePortals(saveRequest)).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(readFile(portalPath, "utf8")).resolves.toBe(yaml);
  });

  it("rejects semantically malformed existing portal YAML instead of repairing it", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    const yaml = "tracked_companies: bad\n";
    await writeFile(portalPath, yaml);

    await expect(createPortalService(configFor(workspace)).savePortals(saveRequest)).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(readFile(portalPath, "utf8")).resolves.toBe(yaml);
  });

  it("preserves existing portal YAML when safe write fails", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writeFile(portalPath, portalYaml);
    await chmod(workspace, 0o555);

    try {
      await expect(createPortalService(configFor(workspace)).savePortals(saveRequest)).rejects.toMatchObject({
        code: "UNEXPECTED_ERROR"
      } satisfies Partial<ApiError>);
      await expect(readFile(portalPath, "utf8")).resolves.toBe(portalYaml);
    } finally {
      await chmod(workspace, 0o700);
    }
  });
});
