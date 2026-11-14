import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { assertObjectReadback, byteLength, digest, makePrefix, objectMetadataArgs, requireNonProductionEnvironment, runMonitoredBackup, sentryIngestUrl, TABLES, verifyObjectReadback } from "../../scripts/cloudflare/phase1-scheduled-backup.mjs";

describe("scheduled recovery generation", () => {
  it("keeps both fixed non-production jobs behind the staging Environment with the authorized DEV pair", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/phase1-backup.yml", import.meta.url), "utf8");
    const development = workflow.match(/  development:\n([\s\S]*?)(?=\n  staging:)/)?.[1];
    const staging = workflow.match(/  staging:\n([\s\S]*)$/)?.[1];

    expect(development).toBeDefined();
    expect(staging).toBeDefined();
    for (const [job, target] of [[development, "development"], [staging, "staging"]]) {
      expect(job).toContain("environment: staging");
      expect(job).toContain("CLOUDFLARE_R2_ID_DEV");
      expect(job).toContain("CLOUDFLARE_R2_SECRET_ACCESS_DEV");
      expect(job).toContain(`phase1-scheduled-backup.mjs ${target}`);
      expect(job).not.toMatch(/if:\s*\$\{\{\s*false\s*\}\}/);
    }
    expect(workflow).not.toMatch(/CLOUDFLARE_R2_(?:ID|SECRET_ACCESS)_STAGING/);
    expect(workflow).not.toContain("phase1-scheduled-backup.mjs production");
  });

  it("aligns both Sentry monitor schedules with the workflow schedule", async () => {
    const workflow = readFileSync(new URL("../../.github/workflows/phase1-backup.yml", import.meta.url), "utf8");
    const workflowSchedule = workflow.match(/cron:\s*[\"']([^\"']+)[\"']/)?.[1];
    expect(workflowSchedule).toBe("15 0 * * *");

    for (const environment of ["development", "staging"]) {
      const fetcher = vi.fn().mockResolvedValue({ ok: true });
      await runMonitoredBackup(environment, {
        ingestUrl: "https://example.ingest.sentry.io/api/1/cron/backup/key/",
        fetcher,
        backup: vi.fn().mockResolvedValue({}),
      });
      const body = JSON.parse(fetcher.mock.calls[0][1].body);
      expect(body.monitor_config.schedule.value).toBe(workflowSchedule);
    }
  });

  it("configures Sentry once before both protected backup jobs", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/phase1-backup.yml", import.meta.url), "utf8");
    const setup = workflow.match(/  sentry-setup:\n([\s\S]*?)(?=\n  development:)/)?.[1];
    const development = workflow.match(/  development:\n([\s\S]*?)(?=\n  staging:)/)?.[1];
    const staging = workflow.match(/  staging:\n([\s\S]*)$/)?.[1];

    expect(setup).toContain("environment: staging");
    expect(workflow.match(/sentry-backup-alert-setup\.mjs/g)).toHaveLength(1);
    for (const job of [development, staging]) {
      expect(job).toContain("needs: sentry-setup");
      expect(job).toContain("environment: staging");
      expect(job).not.toContain("sentry-backup-alert-setup.mjs");
    }
  });

  it("runs only staging on the exact candidate-branch push and preserves schedule/manual routing", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/phase1-backup.yml", import.meta.url), "utf8");
    const development = workflow.match(/  development:\n([\s\S]*?)(?=\n  staging:)/)?.[1];
    const staging = workflow.match(/  staging:\n([\s\S]*)$/)?.[1];

    expect(workflow).toMatch(/push:\n\s+branches:\n\s+- codex\/phase1-backup-staging-test-main/);
    expect(development).toContain("github.event_name == 'schedule'");
    expect(development).not.toContain("github.event_name == 'push'");
    expect(staging).toContain("github.event_name == 'push'");
    expect(staging).toContain("refs/heads/codex/phase1-backup-staging-test-main");
    expect(workflow).toContain("inputs.target == 'development'");
    expect(workflow).toContain("inputs.target == 'staging'");
    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/codex/phase1-backup-staging-test-main' && 'staging'");
    expect(workflow).toContain("|| 'both'");
  });

  it("evaluates workflow event routing across push, schedule, and manual targets", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/phase1-backup.yml", import.meta.url), "utf8");
    const jobCondition = (job: string) => {
      const section = workflow.match(new RegExp(`  ${job}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:|$)`))?.[1];
      return section?.match(/^    if: \$\{\{ ([^\n]+) \}\}$/m)?.[1] ?? "true";
    };
    const sentryTargetExpression = workflow.match(/sentry-backup-alert-setup\.mjs "\$\{\{ ([^\n]+) \}\}"/)?.[1];
    expect(sentryTargetExpression).toBeDefined();

    const evaluate = (expression: string, event: string, target: string | undefined, branch = "codex/phase1-backup-staging-test-main") => {
      const context = { event_name: event, ref: `refs/heads/${branch}` };
      return new Function("github", "inputs", `return (${expression});`)(context, { target });
    };

    const cases = [
      { event: "push", target: undefined, branch: "codex/phase1-backup-staging-test-main", sentrySetup: true, sentry: "staging", development: false, staging: true },
      { event: "push", target: undefined, branch: "main", sentrySetup: false, sentry: "both", development: false, staging: false },
      { event: "schedule", target: undefined, branch: "main", sentrySetup: true, sentry: "both", development: true, staging: true },
      { event: "workflow_dispatch", target: "development", branch: "main", sentrySetup: true, sentry: "development", development: true, staging: false },
      { event: "workflow_dispatch", target: "staging", branch: "main", sentrySetup: true, sentry: "staging", development: false, staging: true },
    ];

    for (const scenario of cases) {
      const { event, target, branch } = scenario;
      expect(evaluate(jobCondition("sentry-setup"), event, target, branch)).toBe(scenario.sentrySetup);
      expect(evaluate(jobCondition("development"), event, target, branch)).toBe(scenario.development);
      expect(evaluate(jobCondition("staging"), event, target, branch)).toBe(scenario.staging);
      expect(evaluate(sentryTargetExpression!, event, target, branch)).toBe(scenario.sentry);
    }
  });

  it("hashes exact bytes and rejects production or unknown environments", () => {
    expect(digest(Buffer.from("media payload"))).toBe("8ddc2c10dd88cf805a3dc78ae42e7271b216e5f80a992a59824931f2264270dc");
    expect(makePrefix("development", Date.UTC(2026, 10, 14), "123e4567-e89b-42d3-a456-426614174000"))
      .toBe("scheduled/development/2026-11-14/20261114T000000Z-123e4567-e89b-42d3-a456-426614174000");
    expect(() => makePrefix("production", Date.UTC(2026, 10, 14), "123e4567-e89b-42d3-a456-426614174000"))
      .toThrow(/development or staging/);
    expect(() => requireNonProductionEnvironment("production")).toThrow(/development or staging/);
    expect(sentryIngestUrl("https://public-key@o123.ingest.sentry.io/456", "backup-dev"))
      .toBe("https://o123.ingest.sentry.io/api/456/cron/backup-dev/public-key/");
    expect(TABLES).toHaveLength(12);
    const unicodeSql = "INSERT INTO pages VALUES ('café 🧭');";
    expect(byteLength(unicodeSql)).toBe(Buffer.byteLength(unicodeSql, "utf8"));
    expect(byteLength(unicodeSql)).not.toBe(unicodeSql.length);
  });

  it("preserves and verifies source object headers and custom metadata with body integrity", () => {
    const metadata = {
      ContentType: "image/svg+xml",
      CacheControl: "public, max-age=300",
      ContentDisposition: "inline",
      ContentEncoding: "gzip",
      ContentLanguage: "en",
      WebsiteRedirectLocation: "/media/new.svg",
      Metadata: { checksum: "abc123", source: "editor" },
    };
    expect(objectMetadataArgs(metadata)).toEqual([
      "--content-type", "image/svg+xml",
      "--cache-control", "public, max-age=300",
      "--content-disposition", "inline",
      "--content-encoding", "gzip",
      "--content-language", "en",
      "--website-redirect-location", "/media/new.svg",
      "--metadata", JSON.stringify(metadata.Metadata),
    ]);
    const body = Buffer.from("<svg>🧭</svg>");
    expect(() => verifyObjectReadback(body, Buffer.from(body), metadata, { ...metadata }, "backup/key" )).not.toThrow();
    expect(() => verifyObjectReadback(body, Buffer.from("different"), metadata, metadata, "backup/key" )).toThrow(/readback verification/);
    expect(() => assertObjectReadback(metadata, { ...metadata, Metadata: { checksum: "changed" } }, "backup/key" )).toThrow(/metadata readback verification/);
  });

  it("reports start, success, and failure with one stable Sentry check-in ID", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const backup = vi.fn().mockResolvedValue({ prefix: "scheduled/development/test", manifest: { d1: { bytes: 3 }, sourceMedia: [] } });
    await runMonitoredBackup("development", { ingestUrl: "https://example.ingest.sentry.io/api/1/cron/dev/key/", checkInId: "123e4567-e89b-42d3-a456-426614174001", fetcher, backup });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const startUrl = new URL(fetcher.mock.calls[0][0]);
    const startBody = JSON.parse(fetcher.mock.calls[0][1].body);
    const finishUrl = new URL(fetcher.mock.calls[1][0]);
    expect(startUrl.searchParams.get("check_in_id")).toBe("123e4567-e89b-42d3-a456-426614174001");
    expect(startUrl.searchParams.get("environment")).toBe("development");
    expect(startBody.monitor_config.schedule.value).toBe("15 0 * * *");
    expect(startBody.monitor_config.max_runtime).toBe(30);
    expect(finishUrl.searchParams.get("check_in_id")).toBe("123e4567-e89b-42d3-a456-426614174001");
    expect(finishUrl.searchParams.get("status")).toBe("ok");

    const failedFetch = vi.fn().mockResolvedValue({ ok: true });
    await expect(runMonitoredBackup("staging", {
      ingestUrl: "https://example.ingest.sentry.io/api/1/cron/staging/key/",
      checkInId: "123e4567-e89b-42d3-a456-426614174002",
      fetcher: failedFetch,
      backup: async () => { throw new Error("export failure"); },
    })).rejects.toThrow("export failure");
    expect(new URL(failedFetch.mock.calls[1][0]).searchParams.get("status")).toBe("error");
    expect(JSON.parse(failedFetch.mock.calls[0][1].body).monitor_config.schedule.value).toBe("15 0 * * *");
  });

  it("runs backup when the Sentry start check-in fails and reports an error check-in after backup failure", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true });
    const backup = vi.fn().mockResolvedValue({ prefix: "scheduled/development/test", manifest: { d1: { bytes: 3 }, sourceMedia: [] } });
    await expect(runMonitoredBackup("development", {
      ingestUrl: "https://example.ingest.sentry.io/api/1/cron/dev/key/",
      checkInId: "123e4567-e89b-42d3-a456-426614174003",
      fetcher,
      backup,
    })).resolves.toEqual(expect.objectContaining({ prefix: "scheduled/development/test" }));
    expect(backup).toHaveBeenCalledOnce();
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("status")).toBe("ok");

    const failureFetch = vi.fn().mockRejectedValue(new Error("Sentry unavailable"));
    await expect(runMonitoredBackup("staging", {
      ingestUrl: "https://example.ingest.sentry.io/api/1/cron/staging/key/",
      checkInId: "123e4567-e89b-42d3-a456-426614174004",
      fetcher: failureFetch,
      backup: async () => { throw new Error("export failure"); },
    })).rejects.toThrow("export failure");
    expect(failureFetch).toHaveBeenCalledTimes(2);
    expect(new URL(failureFetch.mock.calls[1][0]).searchParams.get("status")).toBe("error");
  });
});
