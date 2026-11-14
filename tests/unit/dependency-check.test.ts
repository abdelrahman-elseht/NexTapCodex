import { describe, expect, it, vi } from "vitest";
import { compareDependencyState, runDependencyAudit } from "../../scripts/quality/dependency-check.mjs";

const baseManifest = {
  name: "nextap-mvp",
  version: "1.0.0",
  engines: { node: "^22.23.5 || >=24.8.0" },
  dependencies: { next: "15.5.28" },
  devDependencies: { vitest: "4.1.12" },
  scripts: { test: "vitest run" },
};

const baseLock = {
  packages: {
    "": {
      name: "nextap-mvp",
      version: "1.0.0",
      engines: { node: "^22.23.5 || >=24.8.0" },
      dependencies: { next: "15.5.28" },
      devDependencies: { vitest: "4.1.12" },
    },
  },
};

describe("compareDependencyState", () => {
  it("accepts matching package and lock roots", () => {
    const report = compareDependencyState(baseManifest, baseLock, baseManifest);

    expect(report.status).toBe("pass");
    expect(report.problems).toEqual([]);
    expect(report.dependencyChanges).toEqual([]);
  });

  it("reports dependency additions, removals, and version changes by section", () => {
    const manifest = {
      ...baseManifest,
      dependencies: { next: "15.5.29", added: "1.0.0" },
      devDependencies: {},
    };

    const report = compareDependencyState(manifest, baseLock, baseManifest);

    expect(report.dependencyChanges).toEqual([
      { section: "dependencies", name: "added", before: null, after: "1.0.0" },
      { section: "dependencies", name: "next", before: "15.5.28", after: "15.5.29" },
      { section: "devDependencies", name: "vitest", before: "4.1.12", after: null },
    ]);
  });

  it("fails when the lock root does not match the manifest", () => {
    const report = compareDependencyState(
      { ...baseManifest, dependencies: { next: "15.5.29" } },
      baseLock,
      baseManifest,
    );

    expect(report.status).toBe("fail");
    expect(report.problems).toContain("package.json and package-lock.json root dependencies differ");
  });

  it("identifies newly introduced and changed lifecycle scripts", () => {
    const manifest = {
      ...baseManifest,
      scripts: { ...baseManifest.scripts, postinstall: "node setup.js" },
    };
    const report = compareDependencyState(manifest, baseLock, baseManifest);

    expect(report.lifecycleChanges).toEqual([
      { name: "postinstall", before: null, after: "node setup.js", introduced: true },
    ]);
  });

  it("marks an unavailable comparison baseline as unverified", () => {
    const report = compareDependencyState(baseManifest, baseLock, null);

    expect(report.status).toBe("pass");
    expect(report.comparison).toBe("unverified");
  });
});

describe("runDependencyAudit", () => {
  it("passes when no high or critical findings are reported", () => {
    const spawn = vi.fn(() => ({
      pid: 1,
      output: [null, JSON.stringify({ metadata: { vulnerabilities: { moderate: 2, high: 0, critical: 0 } } }), ""],
      status: 0,
      stdout: JSON.stringify({ metadata: { vulnerabilities: { moderate: 2, high: 0, critical: 0 } } }),
      stderr: "",
      signal: null,
    }));

    const report = runDependencyAudit({ cwd: "/repo", spawn });

    expect(report).toMatchObject({ status: "pass", counts: { moderate: 2, high: 0, critical: 0 } });
    expect(spawn).toHaveBeenCalledWith("npm", ["audit", "--audit-level=high", "--json"], expect.objectContaining({ timeout: 30_000 }));
  });

  it("fails on high or critical findings", () => {
    const report = runDependencyAudit({
      cwd: "/repo",
      spawn: () => ({
        pid: 1,
        output: [null, JSON.stringify({ metadata: { vulnerabilities: { high: 1, critical: 0 } } }), ""],
        status: 1,
        stdout: JSON.stringify({ metadata: { vulnerabilities: { high: 1, critical: 0 } } }),
        stderr: "",
        signal: null,
      }),
    });

    expect(report.status).toBe("fail");
  });

  it("reports timeout and network errors as unverified", () => {
    const timeout = runDependencyAudit({
      cwd: "/repo",
      timeoutMs: 1_000,
      spawn: () => ({ pid: null, output: [null, "", ""], status: null, stdout: "", stderr: "", signal: null, error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }) }),
    });
    const network = runDependencyAudit({
      cwd: "/repo",
      spawn: () => ({ pid: 1, output: [null, "", "ECONNRESET registry.npmjs.org"], status: 1, stdout: "", stderr: "ECONNRESET registry.npmjs.org", signal: null }),
    });

    expect(timeout).toMatchObject({ status: "unverified", detail: "npm audit exceeded 1000 ms" });
    expect(network).toMatchObject({ status: "unverified", detail: "ECONNRESET registry.npmjs.org" });
  });
});
