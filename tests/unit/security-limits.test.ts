import { beforeEach, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimits } from "@/lib/security/rate-limit";

beforeEach(() => resetRateLimits());

it("enforces a separate bounded budget per operation and principal", () => {
  expect(consumeRateLimit("draft", "owner-a", { max: 2, windowMs: 60_000 })).toMatchObject({ allowed: true });
  expect(consumeRateLimit("draft", "owner-a", { max: 2, windowMs: 60_000 })).toMatchObject({ allowed: true });
  expect(consumeRateLimit("draft", "owner-a", { max: 2, windowMs: 60_000 }).allowed).toBe(false);
  expect(consumeRateLimit("draft", "owner-b", { max: 2, windowMs: 60_000 }).allowed).toBe(true);
  expect(consumeRateLimit("export", "owner-a", { max: 2, windowMs: 60_000 }).allowed).toBe(true);
});

it("evicts keys when the configured key bound is reached", () => {
  for (const key of ["a", "b", "c"]) consumeRateLimit("lookup", key, { max: 10, windowMs: 60_000, maxKeys: 2 });
  expect(consumeRateLimit("lookup", "c", { max: 10, windowMs: 60_000, maxKeys: 2 }).allowed).toBe(true);
});
