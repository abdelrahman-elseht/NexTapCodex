import { describe, expect, it } from "vitest";
import { buildManifest, classifyFiles, evaluateReview } from "../../scripts/ci/self-review.mjs";

const sha = (character: string) => character.repeat(40);

function body({ highRisk = false, release = false, owner = "owner", riskLevel = "high" } = {}) {
  const items = ["SR-1", "SR-2", "SR-3", "SR-4", "SR-5"];
  if (highRisk) items.push("SR-H1", "SR-H2", "SR-H3");
  if (release) items.push("SR-R1", "SR-R2", "SR-R3", "SR-R4", "SR-R5");
  return [
    "## Self-review",
    `Self-review owner: @${owner}`,
    `Risk level: ${riskLevel}`,
    "Blast radius: admin inventory",
    "Merge danger: deletion is one-way; transport is recoverable",
    "Evidence: https://github.com/example/evidence",
    ...items.map((item) => `- [x] ${item} completed`),
    ...(release
      ? [
          `Release source SHA: ${sha("a")}`,
          `Accepted Staging SHA: ${sha("a")}`,
          "Hosted Staging acceptance artifact: https://github.com/example/artifact",
          "Migration history/checksums: verified against Staging",
          "Production recovery target: deployment dpl_last_good and backup 2026-10-15",
          "Production smoke evidence: https://github.com/example/smoke",
        ]
      : []),
  ].join("\n");
}

const pullRequest = (overrides = {}) => ({
  number: 7,
  state: "open",
  draft: false,
  body: body(),
  user: { login: "owner" },
  base: { ref: "staging", sha: sha("b") },
  head: { ref: "feature/example", sha: sha("a") },
  ...overrides,
});

describe("self-review gate", () => {
  it("requires the author-owned checklist and passes a complete feature review", () => {
    const result = evaluateReview({
      pr: pullRequest(),
      files: [{ filename: "docs/example.md", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "+documented" }],
    });
    expect(result.ok).toBe(true);
    expect(result.risk.level).toBe("medium");
  });

  it("classifies migrations and destructive SQL as high risk", () => {
    const risk = classifyFiles([{ filename: "supabase/migrations/202610150001_change.sql", patch: "+drop table public.cards;" }]);
    expect(risk.highRisk).toBe(true);
    expect(risk.destructive).toBe(true);
    expect(evaluateReview({ pr: pullRequest({ body: body({ riskLevel: "medium" }) }), files: [{ filename: "supabase/migrations/202610150001_change.sql", patch: "+drop table public.cards;" }] }).errors).toContain(
      "High-risk changes must be marked `Risk level: high`.",
    );
  });

  it("rejects a self-review signed by somebody other than the PR author", () => {
    const result = evaluateReview({ pr: pullRequest({ body: body({ owner: "another-user" }) }), files: [] });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Self-review owner @another-user must match PR author @owner.");
  });

  it("requires exact source and hosted acceptance evidence for a staging release", () => {
    const pr = pullRequest({
      base: { ref: "main", sha: sha("b") },
      head: { ref: "staging", sha: sha("a") },
      body: body({ release: true }),
    });
    const accepted = evaluateReview({
      pr,
      files: [{ filename: "docs/example.md", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "+documented" }],
      hostedAcceptanceRuns: [{ event: "workflow_dispatch", conclusion: "success", head_sha: sha("a") }],
    });
    expect(accepted.ok).toBe(true);

    const missingAcceptance = evaluateReview({
      pr,
      files: [{ filename: "docs/example.md", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "+documented" }],
      hostedAcceptanceRuns: [],
    });
    expect(missingAcceptance.errors).toContain("A successful manual Hosted Staging acceptance run for the exact release SHA was not found.");
  });

  it("does not persist a detected secret in the review artifact", () => {
    const files = [{ filename: "src/config.ts", status: "modified", additions: 1, deletions: 0, changes: 1, patch: '+secret = "this-value-should-not-leak"' }];
    const pr = pullRequest();
    const result = evaluateReview({ pr, files });
    const manifest = buildManifest({ repo: "owner/repo", pr, files, result, generatedAt: "2026-10-15T00:00:00Z" });
    expect(JSON.stringify(manifest)).not.toContain("this-value-should-not-leak");
    expect(manifest.risk.secretLineFiles).toEqual(["src/config.ts"]);
  });
});
