import { describe, expect, it } from "vitest";
import { assertSupabaseEnvironment, SUPABASE_PROJECTS } from "../../src/lib/config/environment.mjs";

const env = (project: string = SUPABASE_PROJECTS.staging) => ({
  NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
});

describe("Supabase environment isolation", () => {
  it.each(["development", "staging", "preview", "test"])("blocks production in %s", NEXTAP_ENV => {
    expect(() => assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), NEXTAP_ENV })).toThrow(/Non-production/);
  });
  it("does not interpret a Next production build as a Production deployment", () => {
    expect(() => assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), NODE_ENV: "production" })).toThrow();
    expect(assertSupabaseEnvironment({ ...env(), NODE_ENV: "production" }).project).toBe("staging");
  });
  it("enforces Vercel targets and rejects conflicting overrides", () => {
    expect(() => assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), VERCEL_ENV: "preview", NEXTAP_ENV: "production" })).toThrow();
    expect(() => assertSupabaseEnvironment({ ...env(), VERCEL_ENV: "production" })).toThrow();
    expect(assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), VERCEL_ENV: "production" }).project).toBe("production");
  });
  it("blocks development and mutation-enabled tests even with an explicit production override", () => {
    expect(() => assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), NEXTAP_ENV: "production", NODE_ENV: "development" })).toThrow();
    expect(() => assertSupabaseEnvironment({ ...env(SUPABASE_PROJECTS.production), NEXTAP_ENV: "production", E2E_ALLOW_MUTATIONS: "true" })).toThrow();
  });
  it("allows local Supabase and CI placeholders only in CI", () => {
    expect(assertSupabaseEnvironment({ ...env(), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).project).toBe("local");
    expect(() => assertSupabaseEnvironment(env("example"))).toThrow();
    expect(assertSupabaseEnvironment({ ...env("example"), CI: "true" }).project).toBe("ci");
  });
  it("rejects unknown projects, malformed URLs, and secret keys", () => {
    expect(() => assertSupabaseEnvironment(env("unknown"))).toThrow();
    expect(() => assertSupabaseEnvironment({ ...env(), NEXT_PUBLIC_SUPABASE_URL: "invalid" })).toThrow();
    expect(() => assertSupabaseEnvironment({ ...env(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong" })).toThrow();
    expect(() => assertSupabaseEnvironment({ ...env(), NEXT_PUBLIC_SUPABASE_URL: `http://${SUPABASE_PROJECTS.staging}.supabase.co` })).toThrow();
  });
});
