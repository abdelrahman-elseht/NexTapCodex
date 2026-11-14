#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const API_ROOT = "https://sentry.io/api/0";
const MONITORS = [
  { slug: "nextap-phase1-development-backup", name: "NexTap Phase 1 development backup" },
  { slug: "nextap-phase1-staging-backup", name: "NexTap Phase 1 staging backup" },
];
const WORKFLOW_NAME = "NexTap Phase 1 backup check-in failures";

function apiError(label, response) {
  return new Error(`Sentry ${label} failed with HTTP ${response.status}; verify SENTRY_AUTH_TOKEN scope and Sentry API access.`);
}

async function request(fetcher, token, path, options = {}) {
  let response;
  try {
    response = await fetcher(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        accept: "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Sentry API request failed for ${path}; verify network access and SENTRY_AUTH_TOKEN.`);
  }
  if (!response.ok) throw apiError(path, response);
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new Error(`Sentry API returned invalid JSON for ${path}.`);
  }
}

async function listAll(fetcher, token, path) {
  const results = [];
  let next = `${API_ROOT}${path}`;
  while (next) {
    const response = await request(fetcher, token, next.slice(API_ROOT.length));
    if (Array.isArray(response)) results.push(...response);
    else if (Array.isArray(response?.results)) results.push(...response.results);
    else throw new Error(`Sentry API returned an unexpected list for ${path}.`);
    next = response?.next ?? null;
    if (next && !next.startsWith(API_ROOT)) throw new Error(`Sentry API returned an unexpected pagination URL for ${path}.`);
  }
  return results;
}

function readDsn(dsn) {
  if (!dsn) throw new Error("SENTRY_DSN is required to discover the Sentry project.");
  let parsed;
  try { parsed = new URL(dsn); } catch { throw new Error("SENTRY_DSN is invalid; expected a Sentry project DSN."); }
  const orgId = parsed.hostname.match(/^o(\d+)\./)?.[1];
  const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (parsed.protocol !== "https:" || !orgId || !projectId) throw new Error("SENTRY_DSN must identify an HTTPS Sentry organization and project.");
  return { orgId, projectId };
}

function scheduleConfig() {
  return { schedule_type: "crontab", schedule: "15 0 * * *", timezone: "UTC", max_runtime: 30 };
}

function desiredWorkflow(organizationId) {
  return {
    name: WORKFLOW_NAME,
    organizationId: String(organizationId),
    triggers: {
      logicType: "any-short",
      conditions: [{
        type: "issue_type",
        comparison: { value: "monitor_check_in_failure", include: true },
      }],
    },
    actionFilters: [{
      logicType: "any-short",
      conditions: [{
        type: "issue_type",
        comparison: { value: "monitor_check_in_failure", include: true },
      }],
      actions: [{
        type: "email",
        integrationId: null,
        status: "active",
        data: { fallthroughType: "AllMembers" },
        config: { targetType: "issue_owners", targetDisplay: null, targetIdentifier: null },
      }],
    }],
  };
}

function isExpectedMonitor(monitor, slug, name, projectSlug) {
  return monitor.slug === slug
    && monitor.name === name
    && monitor.status === "active"
    && String(monitor.projectSlug ?? monitor.project?.slug ?? monitor.project) === String(projectSlug)
    && monitor.config?.schedule_type === "crontab"
    && monitor.config?.schedule === "15 0 * * *"
    && monitor.config?.timezone === "UTC"
    && monitor.config?.max_runtime === 30;
}

function isExpectedWorkflow(workflow, expected) {
  const isFailureCondition = (condition) => condition?.type === "issue_type"
    && condition.comparison?.value === "monitor_check_in_failure"
    && condition.comparison?.include === true
    && condition.conditionResult === true;
  const hasSingleFailureCondition = (group) => group?.logicType === "any-short"
    && Array.isArray(group.conditions)
    && group.conditions.length === 1
    && isFailureCondition(group.conditions[0]);
  const actionFilter = Array.isArray(workflow.actionFilters) && workflow.actionFilters.length === 1
    ? workflow.actionFilters[0]
    : null;
  const actions = actionFilter?.actions;
  const emailAction = Array.isArray(actions) && actions.length === 1 ? actions[0] : null;

  return workflow.name === expected.name
    && workflow.enabled === true
    && String(workflow.organizationId) === expected.organizationId
    && hasSingleFailureCondition(workflow.triggers)
    && hasSingleFailureCondition(actionFilter)
    && emailAction?.type === "email"
    && emailAction.status === "active"
    && emailAction.integrationId === null
    && emailAction.config?.targetType === "issue_owners"
    && emailAction.config?.targetIdentifier === null
    && emailAction.data?.fallthroughType === "AllMembers";
}

/** @param {{dsn?: string, token?: string, fetcher?: typeof fetch}} options Configure and verify both scheduled monitors and the organization failure workflow. */
export async function configureSentryBackupAlerts({ dsn, token, fetcher = fetch } = {}) {
  if (!token) throw new Error("SENTRY_AUTH_TOKEN is required to configure Sentry backup alerts.");
  const { orgId, projectId } = readDsn(dsn);
  const organizations = await listAll(fetcher, token, "/organizations/");
  const organization = organizations.find((item) => String(item.id) === orgId);
  if (!organization?.slug) throw new Error(`Sentry organization ${orgId} was not found for SENTRY_DSN; verify token organization access.`);
  const projects = await listAll(fetcher, token, `/organizations/${encodeURIComponent(organization.slug)}/projects/`);
  const project = projects.find((item) => String(item.id) === projectId);
  if (!project?.slug) throw new Error(`Sentry project ${projectId} was not found in organization ${organization.slug}; verify token project access.`);

  const monitorPath = `/organizations/${encodeURIComponent(organization.slug)}/monitors/`;
  const existingMonitors = await listAll(fetcher, token, monitorPath);
  for (const desired of MONITORS) {
    const prior = existingMonitors.find((item) => item.slug === desired.slug);
    const body = {
      project: project.slug,
      name: desired.name,
      slug: desired.slug,
      type: "cron_job",
      status: "active",
      config: scheduleConfig(),
      ...(prior?.alert_rule_id ? { alert_rule_id: prior.alert_rule_id } : {}),
    };
    if (prior?.id) {
      await request(fetcher, token, `${monitorPath}${encodeURIComponent(prior.id)}/`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await request(fetcher, token, monitorPath, { method: "POST", body: JSON.stringify(body) });
    }
  }

  const workflowPath = `/organizations/${encodeURIComponent(organization.slug)}/workflows/`;
  const expected = desiredWorkflow(organization.id);
  const workflows = await listAll(fetcher, token, workflowPath);
  const existingWorkflow = workflows.find((workflow) => workflow.name === WORKFLOW_NAME);
  if (existingWorkflow?.id) {
    await request(fetcher, token, `${workflowPath}${encodeURIComponent(existingWorkflow.id)}/`, { method: "PUT", body: JSON.stringify(expected) });
  } else {
    await request(fetcher, token, workflowPath, { method: "POST", body: JSON.stringify(expected) });
  }

  const verifiedMonitors = await listAll(fetcher, token, monitorPath);
  for (const desired of MONITORS) {
    const actual = verifiedMonitors.find((item) => item.slug === desired.slug);
    if (!actual || !isExpectedMonitor(actual, desired.slug, desired.name, project.slug)) {
      throw new Error(`Sentry monitor ${desired.slug} readback did not confirm the required project, Cron schedule, and UTC timezone.`);
    }
  }
  const verifiedWorkflows = await listAll(fetcher, token, workflowPath);
  const verifiedWorkflow = verifiedWorkflows.find((workflow) => workflow.name === WORKFLOW_NAME);
  if (!verifiedWorkflow || !isExpectedWorkflow(verifiedWorkflow, expected)) {
    throw new Error("Sentry organization workflow readback did not confirm monitor failure detection and issue-owner email with AllMembers fallback.");
  }
  return { organization: organization.slug, project: project.slug, monitors: MONITORS.map(({ slug }) => slug), workflow: WORKFLOW_NAME };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  configureSentryBackupAlerts({ dsn: process.env.SENTRY_DSN, token: process.env.SENTRY_AUTH_TOKEN })
    .then(({ organization, project, monitors, workflow }) => {
      process.stdout.write(`Sentry alert configuration verified for ${organization}/${project}: ${monitors.join(", ")} and ${workflow}.\n`);
    })
    .catch((error) => {
      process.stderr.write(`Sentry backup alert setup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
      process.exitCode = 1;
    });
}
