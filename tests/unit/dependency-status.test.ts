import { describe, expect, it } from "vitest";
import { changedDirectDependencies } from "../../scripts/ci/dependency-status.mjs";

describe("dependency status comparison", () => {
  it("reports added or version-changed direct dependencies only", () => {
    const baseManifest = { dependencies: { next: "15.5.28" }, devDependencies: { eslint: "^9.35.0" } };
    const currentManifest = { dependencies: { next: "15.5.28" }, devDependencies: { eslint: "^9.35.0", knip: "6.44.1" } };
    const baseLock = { packages: { "node_modules/next": { version: "15.5.28" }, "node_modules/eslint": { version: "9.35.0" } } };
    const currentLock = { packages: { "node_modules/next": { version: "15.5.28" }, "node_modules/eslint": { version: "9.35.0" }, "node_modules/knip": { version: "6.44.1" } } };

    expect(changedDirectDependencies(baseManifest, currentManifest, baseLock, currentLock)).toEqual(["knip"]);
  });

  it("reports an unchanged range whose resolved lockfile version moved", () => {
    const manifest = { dependencies: { example: "^1.0.0" } };
    const baseLock = { packages: { "node_modules/example": { version: "1.0.1" } } };
    const currentLock = { packages: { "node_modules/example": { version: "1.0.2" } } };

    expect(changedDirectDependencies(manifest, manifest, baseLock, currentLock)).toEqual(["example"]);
  });

  it("reports a removed direct dependency for caller review", () => {
    const baseManifest = { devDependencies: { retired: "1.0.0" } };
    const currentManifest = { devDependencies: {} };
    const baseLock = { packages: { "node_modules/retired": { version: "1.0.0" } } };
    const currentLock = { packages: {} };

    expect(changedDirectDependencies(baseManifest, currentManifest, baseLock, currentLock)).toEqual(["retired"]);
  });
});
