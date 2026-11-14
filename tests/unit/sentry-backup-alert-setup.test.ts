import { describe, expect, it, vi } from "vitest";
import { configureSentryBackupAlerts } from "../../scripts/cloudflare/sentry-backup-alert-setup.mjs";

const dsn = "https://public-key@o123.ingest.sentry.io/456";
const token = "synthetic-auth-token";
const org = { id: 123, slug: "nextap-org" };
const project = { id: 456, slug: "nextap" };
const workflow = {
  id: "workflow-1",
  name: "NexTap Phase 1 backup check-in failures",
  logicType: "any-short",
  triggers: {
    logicType: "any-short",
    conditions: [{ type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true } }],
  },
  actionFilters: [{
    logicType: "any-short",
    conditions: [{ type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true } }],
    actions: [{
    type: "email",
    integrationId: null,
    status: "active",
    config: { targetType: "issue_owners", targetDisplay: null, targetIdentifier: null },
    data: { fallthroughType: "AllMembers" },
  }] }],
};

function monitor(slug: string, id: string) {
  return {
    id,
    slug,
    name: slug === "nextap-phase1-development-backup"
      ? "NexTap Phase 1 development backup"
      : "NexTap Phase 1 staging backup",
    status: "active",
    type: "cron_job",
    project: { slug: "nextap" },
    config: { schedule_type: "crontab", schedule: "15 0 * * *", timezone: "UTC", max_runtime: 30 },
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Sentry backup alert setup", () => {
  it("configures and verifies only the selected monitor for a staging test run", async () => {
    const monitors: ReturnType<typeof monitor>[] = [];
    let workflows: typeof workflow[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/organizations/")) return response([org]);
      if (url.endsWith("/projects/")) return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") return response(monitors);
      if (url.endsWith("/workflows/") && method === "GET") return response(workflows);
      if (url.endsWith("/monitors/") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        monitors.push(Object.assign(monitor(body.slug, "monitor-staging"), { name: body.name }));
        return response(monitors.at(-1));
      }
      if (url.endsWith("/workflows/") && method === "POST") {
        workflows = [workflow];
        return response(workflow);
      }
      throw new Error(`Unexpected mocked request: ${method} ${url}`);
    });

    await expect(configureSentryBackupAlerts({ dsn, token, target: "staging", fetcher })).resolves.toMatchObject({
      monitors: ["nextap-phase1-staging-backup"],
    });
    const monitorBodies = fetcher.mock.calls
      .filter(([url, init]) => String(url).endsWith("/monitors/") && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(monitorBodies.map(({ slug }) => slug)).toEqual(["nextap-phase1-staging-backup"]);
    expect(monitors.map(({ slug }) => slug)).toEqual(["nextap-phase1-staging-backup"]);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("nextap-phase1-development-backup"))).toBe(false);
  });

  it("rejects unknown monitor targets before making provider requests", async () => {
    const fetcher = vi.fn();
    await expect(configureSentryBackupAlerts({ dsn, token, target: "production", fetcher })).rejects.toThrow(/target must be development, staging, or both/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates both fixed monitors and the org workflow, then verifies their readback", async () => {
    const monitors: ReturnType<typeof monitor>[] = [];
    let workflows: typeof workflow[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
      if (url.endsWith("/organizations/") && method === "GET") return response([org]);
      if (url.endsWith("/projects/") && method === "GET") return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") return response(monitors);
      if (url.endsWith("/workflows/") && method === "GET") return response(workflows);
      if (url.endsWith("/monitors/") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        monitors.push(Object.assign(monitor(body.slug, `id-${monitors.length}`), { name: body.name }));
        return response(monitors.at(-1));
      }
      if (url.endsWith("/workflows/") && method === "POST") {
        workflows = [workflow];
        return response(workflow);
      }
      throw new Error(`Unexpected mocked request: ${method} ${url}`);
    });

    await expect(configureSentryBackupAlerts({ dsn, token, fetcher })).resolves.toMatchObject({
      organization: "nextap-org",
      project: "nextap",
      monitors: ["nextap-phase1-development-backup", "nextap-phase1-staging-backup"],
      workflow: workflow.name,
    });
    const monitorBodies = fetcher.mock.calls.filter(([url, init]) => String(url).endsWith("/monitors/") && init?.method === "POST").map(([, init]) => JSON.parse(String(init?.body)));
    expect(monitorBodies).toHaveLength(2);
    expect(monitorBodies.map((body) => body.config.schedule_type)).toEqual(["crontab", "crontab"]);
    expect(monitorBodies.map((body) => body.config.schedule)).toEqual(["15 0 * * *", "15 0 * * *"]);
    expect(monitorBodies.every((body) => body.config.max_runtime === 30)).toBe(true);
    expect(monitorBodies.every((body) => body.project === project.slug && body.config.timezone === "UTC")).toBe(true);
    expect(JSON.parse(String(fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/workflows/") && init?.method === "POST")?.[1]?.body))).toEqual({
      name: workflow.name,
      logicType: "any-short",
      triggers: {
        logicType: "any-short",
        conditions: [{ type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true } }],
      },
      actionFilters: [{
        logicType: "any-short",
        conditions: [{ type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true } }],
        actions: [{
        type: "email",
        integrationId: null,
        status: "active",
        data: { fallthroughType: "AllMembers" },
        config: { targetType: "issue_owners", targetDisplay: null, targetIdentifier: null },
      }] }],
    });
  });

  it("updates existing monitors and workflow without adding alert_rule_id", async () => {
    const monitors = [monitor("nextap-phase1-development-backup", "monitor-dev"), monitor("nextap-phase1-staging-backup", "monitor-staging")];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/organizations/")) return response([org]);
      if (url.endsWith("/projects/")) return response([project]);
      if (url.endsWith("/monitors/") && !init?.method) return response(monitors);
      if (url.endsWith("/workflows/") && !init?.method) return response([workflow]);
      if (url.includes("/monitors/") && init?.method === "PUT") return response({});
      if (url.includes("/workflows/workflow-1/") && init?.method === "PUT") return response({});
      throw new Error(`Unexpected mocked request: ${init?.method ?? "GET"} ${url}`);
    });

    await configureSentryBackupAlerts({ dsn, token, fetcher });
    const updates = fetcher.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(updates).toHaveLength(3);
    expect(updates.map(([, init]) => JSON.parse(String(init?.body))).every((body) => !("alert_rule_id" in body))).toBe(true);
  });

  it.each([
    ["monitor name", (value: ReturnType<typeof monitor>) => { value.name = "Unexpected monitor name"; }],
    ["monitor status", (value: ReturnType<typeof monitor>) => { value.status = "disabled"; }],
    ["monitor project", (value: ReturnType<typeof monitor>) => { value.project = { slug: "other" }; }],
    ["monitor schedule", (value: ReturnType<typeof monitor>) => { value.config.schedule = "0 0 * * *"; }],
    ["monitor timezone", (value: ReturnType<typeof monitor>) => { value.config.timezone = "America/Los_Angeles"; }],
    ["monitor max runtime", (value: ReturnType<typeof monitor>) => { value.config.max_runtime = 29; }],
  ])("rejects a structurally incorrect %s readback", async (_label, mutate) => {
    const monitors: ReturnType<typeof monitor>[] = [];
    let monitorReads = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/organizations/")) return response([org]);
      if (url.endsWith("/projects/")) return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") {
        monitorReads += 1;
        if (monitorReads > 1 && monitors[0]) mutate(monitors[0]);
        return response(monitors);
      }
      if (url.endsWith("/workflows/") && method === "GET") return response([workflow]);
      if (url.includes("/workflows/workflow-1/") && method === "PUT") return response(workflow);
      if (url.endsWith("/monitors/") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const created = Object.assign(monitor(body.slug, `id-${monitors.length}`), { name: body.name });
        monitors.push(created);
        return response(created);
      }
      if (url.endsWith("/workflows/") && method === "POST") return response(workflow);
      throw new Error(`Unexpected mocked request: ${method} ${url}`);
    });

    await expect(configureSentryBackupAlerts({ dsn, token, fetcher })).rejects.toThrow(/readback/);
  });

  it.each([
    ["trigger condition", (value: typeof workflow) => { value.triggers.conditions[0].comparison.value = "other"; }],
    ["trigger condition type", (value: typeof workflow) => { value.triggers.conditions[0].type = "issue"; }],
    ["action filter condition", (value: typeof workflow) => { value.actionFilters[0].conditions[0].comparison.value = "other"; }],
    ["action filter condition type", (value: typeof workflow) => { value.actionFilters[0].conditions[0].type = "issue"; }],
    ["action recipient", (value: typeof workflow) => { value.actionFilters[0].actions[0].config.targetType = "managers"; }],
    ["fallback recipient", (value: typeof workflow) => { value.actionFilters[0].actions[0].data.fallthroughType = "none"; }],
  ])("rejects a structurally incorrect workflow %s readback", async (_label, mutate) => {
    const monitors: ReturnType<typeof monitor>[] = [];
    let monitorReads = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/organizations/")) return response([org]);
      if (url.endsWith("/projects/")) return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") {
        monitorReads += 1;
        return response(monitors);
      }
      if (url.endsWith("/workflows/") && method === "GET") {
        if (monitorReads < 2) return response([]);
        const altered = structuredClone(workflow);
        mutate(altered);
        return response([altered]);
      }
      if (url.endsWith("/monitors/") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const created = Object.assign(monitor(body.slug, `id-${monitors.length}`), { name: body.name });
        monitors.push(created);
        return response(created);
      }
      if (url.endsWith("/workflows/") && method === "POST") return response(workflow);
      throw new Error(`Unexpected mocked request: ${method} ${url}`);
    });

    await expect(configureSentryBackupAlerts({ dsn, token, fetcher })).rejects.toThrow(/workflow readback/);
  });

  it("fails with the exact API status before later setup calls when token scope is insufficient", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ detail: "redacted" }, 403));
    await expect(configureSentryBackupAlerts({ dsn, token, fetcher })).rejects.toThrow("HTTP 403; verify SENTRY_AUTH_TOKEN scope and Sentry API access.");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("public-key");
  });
});
