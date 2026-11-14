import { describe, expect, it, vi } from "vitest";
import { configureSentryBackupAlerts } from "../../scripts/cloudflare/sentry-backup-alert-setup.mjs";

const dsn = "https://public-key@o123.ingest.sentry.io/456";
const token = "synthetic-auth-token";
const org = { id: 123, slug: "nextap-org" };
const project = { id: 456, slug: "nextap" };
const workflow = {
  id: "workflow-1",
  name: "NexTap Phase 1 backup check-in failures",
  enabled: true,
  organizationId: "123",
  triggers: {
    id: "trigger-1",
    organizationId: "123",
    logicType: "any-short",
    conditions: [{ id: "trigger-condition-1", type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true }, conditionResult: true }],
  },
  actionFilters: [{
    id: "action-filter-1",
    organizationId: "123",
    logicType: "any-short",
    conditions: [{ id: "action-condition-1", type: "issue_type", comparison: { value: "monitor_check_in_failure", include: true }, conditionResult: true }],
    actions: [{
      type: "email",
      integrationId: null,
      status: "active",
      config: { targetType: "issue_owners", targetIdentifier: null },
      data: { fallthroughType: "AllMembers" },
    }],
  }],
};

function monitor(slug: string, id: string) {
  return {
    id,
    slug,
    name: slug === "nextap-phase1-development-backup"
      ? "NexTap Phase 1 development backup"
      : "NexTap Phase 1 staging backup",
    status: "active",
    project: { slug: "nextap" },
    config: { schedule_type: "crontab", schedule: "15 0 * * *", timezone: "UTC", max_runtime: 30 },
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Sentry backup alert setup", () => {
  it.each(["development", "staging"] as const)("configures only the %s monitor and the org workflow", async (target) => {
    const monitors: ReturnType<typeof monitor>[] = [];
    let workflows: typeof workflow[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
      if (url.endsWith("/organizations/") && method === "GET") return response([org]);
      if (url.endsWith("/projects/") && method === "GET") return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") return response(monitors);
      if (url.endsWith("/workflows/") && method === "GET") return response({ results: workflows });
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

    const expectedSlug = `nextap-phase1-${target}-backup`;
    await expect(configureSentryBackupAlerts({ target, dsn, token, fetcher })).resolves.toMatchObject({
      organization: "nextap-org",
      project: "nextap",
      monitors: [expectedSlug],
      workflow: workflow.name,
    });
    const monitorBodies = fetcher.mock.calls.filter(([url, init]) => String(url).endsWith("/monitors/") && init?.method === "POST").map(([, init]) => JSON.parse(String(init?.body)));
    expect(monitorBodies).toHaveLength(1);
    expect(monitorBodies.map((body) => body.slug)).toEqual([expectedSlug]);
    expect(monitorBodies.map((body) => body.config.schedule_type)).toEqual(["crontab"]);
    expect(monitorBodies.map((body) => body.config.schedule)).toEqual(["15 0 * * *"]);
    expect(monitorBodies.every((body) => body.config.max_runtime === 30)).toBe(true);
    expect(monitorBodies.every((body) => body.project === project.slug && body.config.timezone === "UTC")).toBe(true);
    const workflowBody = JSON.parse(String(fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/workflows/") && init?.method === "POST")?.[1]?.body));
    expect(workflowBody).not.toHaveProperty("logicType");
    expect(workflowBody).toEqual({
      name: workflow.name,
      organizationId: "123",
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

  it.each([undefined, "production", ""])("rejects a missing or invalid target (%s) before API access", async (target) => {
    const fetcher = vi.fn();
    await expect(configureSentryBackupAlerts({ target, dsn, token, fetcher } as Parameters<typeof configureSentryBackupAlerts>[0]))
      .rejects.toThrow("A Sentry monitor target of development or staging is required.");
    expect(fetcher).not.toHaveBeenCalled();
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

    await configureSentryBackupAlerts({ target: "development", dsn, token, fetcher });
    const updates = fetcher.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(updates).toHaveLength(2);
    expect(updates.map(([, init]) => JSON.parse(String(init?.body))).every((body) => !("alert_rule_id" in body))).toBe(true);
  });

  it.each([
    ["monitor slug", (value: ReturnType<typeof monitor>) => { value.slug = "unexpected-slug"; }],
    ["monitor name", (value: ReturnType<typeof monitor>) => { value.name = "Unexpected monitor name"; }],
    ["monitor status", (value: ReturnType<typeof monitor>) => { value.status = "disabled"; }],
    ["monitor project", (value: ReturnType<typeof monitor>) => { value.project = { slug: "other" }; }],
    ["monitor schedule type", (value: ReturnType<typeof monitor>) => { value.config.schedule_type = "interval"; }],
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

    await expect(configureSentryBackupAlerts({ target: "development", dsn, token, fetcher })).rejects.toThrow(/readback/);
  });

  it.each([
    ["missing enabled", (value: any) => { delete value.enabled; }],
    ["false enabled", (value: any) => { value.enabled = false; }],
    ["trigger condition", (value: any) => { value.triggers.conditions[0].comparison.value = "other"; }],
    ["missing trigger group", (value: any) => { delete value.triggers; }],
    ["wrong trigger logic", (value: any) => { value.triggers.logicType = "all"; }],
    ["wrong trigger condition result", (value: any) => { value.triggers.conditions[0].conditionResult = false; }],
    ["wrong workflow organization", (value: any) => { value.organizationId = "other"; }],
    ["missing action filters", (value: any) => { delete value.actionFilters; }],
    ["wrong action filter logic", (value: any) => { value.actionFilters[0].logicType = "all"; }],
    ["wrong action filter condition", (value: any) => { value.actionFilters[0].conditions[0].comparison.value = "other"; }],
    ["legacy array trigger", (value: any) => { value.triggers = [{ type: "issue", comparison: { field: "issue_type", value: "monitor_check_in_failure", include: true } }]; }],
    ["legacy comparison field", (value: any) => { value.triggers.conditions[0].comparison.field = "issue_type"; delete value.triggers.conditions[0].comparison.value; }],
    ["missing condition result", (value: any) => { delete value.triggers.conditions[0].conditionResult; }],
    ["action recipient", (value: any) => { value.actionFilters[0].actions[0].config.targetType = "managers"; }],
    ["missing email action status", (value: any) => { delete value.actionFilters[0].actions[0].status; }],
    ["wrong email action integration", (value: any) => { value.actionFilters[0].actions[0].integrationId = "unexpected"; }],
    ["fallback recipient", (value: any) => { value.actionFilters[0].actions[0].data.fallthroughType = "none"; }],
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
        const altered: any = structuredClone(workflow);
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

    await expect(configureSentryBackupAlerts({ target: "development", dsn, token, fetcher })).rejects.toThrow(/workflow readback/);
  });

  it("reports only boolean workflow predicates when readback contains secret-shaped values", async () => {
    const secret = "sentry-secret-shaped-value";
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
        const altered: any = structuredClone(workflow);
        altered.name = secret;
        altered.providerPayload = { credential: secret };
        altered.actionFilters[0].actions[0].config.targetIdentifier = { token: secret };
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

    let errorMessage = "";
    try {
      await configureSentryBackupAlerts({ target: "development", dsn, token, fetcher });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "";
    }
    expect(errorMessage).toContain('"name":false');
    expect(errorMessage).toContain('"emailActionTargetIdentifier":false');
    expect(errorMessage).toContain('"workflowFound":false');
    expect(errorMessage).not.toContain(secret);
    expect(errorMessage).not.toContain("providerPayload");
    expect(errorMessage).not.toContain("credential");
  });

  it("rejects a missing workflow readback", async () => {
    const monitors: ReturnType<typeof monitor>[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/organizations/")) return response([org]);
      if (url.endsWith("/projects/")) return response([project]);
      if (url.endsWith("/monitors/") && method === "GET") return response(monitors);
      if (url.endsWith("/monitors/") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const created = Object.assign(monitor(body.slug, `id-${monitors.length}`), { name: body.name });
        monitors.push(created);
        return response(created);
      }
      if (url.endsWith("/workflows/") && method === "GET") return response({ results: [] });
      if (url.endsWith("/workflows/") && method === "POST") return response(workflow);
      throw new Error(`Unexpected mocked request: ${method} ${url}`);
    });

    await expect(configureSentryBackupAlerts({ target: "development", dsn, token, fetcher })).rejects.toThrow(/workflow readback/);
  });

  it("fails with the exact API status before later setup calls when token scope is insufficient", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ detail: "redacted" }, 403));
    await expect(configureSentryBackupAlerts({ target: "development", dsn, token, fetcher })).rejects.toThrow("HTTP 403; verify SENTRY_AUTH_TOKEN scope and Sentry API access.");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("public-key");
  });
});
