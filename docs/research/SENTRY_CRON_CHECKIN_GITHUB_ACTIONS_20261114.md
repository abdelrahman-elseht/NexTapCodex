# Sentry Cron Check-Ins from GitHub Actions

Research checked against Sentry's official documentation on 2026-11-14.

## Check-in contract

Sentry's HTTP check-in ingestion URL is:

```text
https://<organization-ingest-domain>/api/<project-id>/cron/<monitor-slug>/<public-key>/
```

Use the organization ingest domain, project ID, monitor slug, and public key from the project's DSN/Sentry setup. This endpoint does not use a Sentry bearer auth token. The public key is embedded in the ingestion URL. Sentry's distinct monitor management API (`POST /api/0/organizations/{organization_id_or_slug}/monitors/`) does use `Authorization: Bearer <token>`.

For check-ins, the docs show GET requests with status in the query string:

```text
GET <check-in-url>?status=in_progress
GET <check-in-url>?status=ok
GET <check-in-url>?status=error
```

Alternatively, POST JSON to the same URL. `status` is a top-level field. To create or update (upsert) the monitor via a check-in, include `monitor_config` with a `schedule`, for example:

```json
{
  "status": "in_progress",
  "monitor_config": {
    "schedule": { "type": "crontab", "value": "0 3 * * *" },
    "checkin_margin": 10,
    "max_runtime": 30,
    "timezone": "UTC"
  }
}
```

The scheduled job should send `in_progress` before work and then `ok` on success or `error` on failure. `check_in_id` may be sent as a query parameter on both check-ins for one execution; Sentry specifically calls for a stable ID when executions may overlap. The check-in environment is optionally sent as `environment=<name>`; omitted environment defaults to `production`.

## Monitor creation and missed-run alerting

A monitor does not have to be created in the UI first. Sentry's HTTP guide says a monitor may be created or updated through the check-in payload (upsert). If relying on that, send `monitor_config.schedule` so Sentry knows the expected cadence. Otherwise, create/configure a Cron monitor in Sentry first and send check-ins against its slug.

For a missing scheduled run, configure the monitor's schedule and optional `checkin_margin` grace period. A missed check-in creates an error event tagged to the monitor. To get notifications, Sentry's guide says to create an alert rule from **Alerts > Create Alert**, choose **Projects or Monitors** as the rule source, and set triggers/filters for the monitor failures (for example, event tag `monitor.slug`). The alert rule is separate from sending check-ins.

The current pricing page lists Cron Monitoring quotas as one cron monitor on Developer, one cron monitor with additional monitors priced at $0.78/monitor on Team and Business, and a custom allowance on Enterprise. The Developer pricing row includes email alerts/notifications. Pricing does not establish that every alert delivery integration is available at every tier; check the desired notification channel against the account's plan. No docs reviewed indicated that missed-run detection itself requires a paid plan.

## Sources

- [Sentry Cron Monitoring HTTP setup](https://docs.sentry.io/product/monitors-and-alerts/monitors/crons/getting-started/http/) — ingestion URL, GET status examples, POST/upsert payload, schedule configuration, environment and overlapping-run options, and alert setup.
- [Sentry Create a Monitor API](https://docs.sentry.io/api/crons/create-a-monitor/) — management endpoint and bearer-token authentication, distinct from check-in ingestion.
- [Sentry pricing](https://sentry.io/pricing/) — plan quotas for Cron Monitoring and alert features.
