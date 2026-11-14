import type { StaffIdentity } from "./auth";

export type RuntimeEnvironment = "development" | "staging";

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes: number; duration: number; last_row_id: number; rows_read: number; rows_written: number };
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob): Promise<R2Object | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  APP_ENV: RuntimeEnvironment;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  NEXTAP_DB: D1Database;
  NEXTAP_PUBLIC_MEDIA: R2Bucket;
  SMOKE_RECOVERY_MEDIA?: R2Bucket;
  NEXTAP_SLUG_CACHE: KVNamespace;
  SMOKE_TOKEN?: string;
  SMOKE_D1_FIXTURE_ID?: string;
  SMOKE_R2_FIXTURE_KEY?: string;
  // Runtime secrets, when a protected operation requires one, are added through Wrangler secrets.
  // They must never be represented in `vars`, returned to clients, or included in logs.
}

const SMOKE_FIXTURE_ID = "recovery-20261114-7f3a-business";
const SMOKE_MEDIA_KEY = "recovery-20261114-7f3a/media/synthetic.txt";
const SMOKE_MEDIA_SIZE = 74;
const SMOKE_MEDIA_SHA256 = "4b6c4c318a9360e28f4b7f80a4f2b994e40076546f4ec052a578f222691af93b";

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    difference |= leftCode ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function smoke(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV !== "staging") return new Response(null, { status: 404 });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  if (!env.SMOKE_TOKEN || !env.SMOKE_D1_FIXTURE_ID || !env.SMOKE_R2_FIXTURE_KEY) {
    return new Response(null, { status: 404 });
  }
  if (env.SMOKE_D1_FIXTURE_ID !== SMOKE_FIXTURE_ID || env.SMOKE_R2_FIXTURE_KEY !== SMOKE_MEDIA_KEY) {
    return new Response(null, { status: 404 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!constantTimeEqual(authorization, `Bearer ${env.SMOKE_TOKEN}`)) return new Response(null, { status: 404 });

  const [d1, r2] = await Promise.all([
    env.NEXTAP_DB.prepare("SELECT 1 AS ready FROM businesses WHERE id = ? LIMIT 1")
      .bind(env.SMOKE_D1_FIXTURE_ID).first("ready").then((result) => result === 1 || result === "1").catch(() => false),
    env.SMOKE_RECOVERY_MEDIA?.get(SMOKE_MEDIA_KEY).then(async (result) => {
      if (!result || result.key !== SMOKE_MEDIA_KEY || result.size !== SMOKE_MEDIA_SIZE) return false;
      const reader = result.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > SMOKE_MEDIA_SIZE) {
          await reader.cancel();
          return false;
        }
        chunks.push(value);
      }
      if (size !== SMOKE_MEDIA_SIZE) return false;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      return hash === SMOKE_MEDIA_SHA256;
    }).catch(() => false) ?? Promise.resolve(false),
  ]);
  return jsonResponse({ environment: env.APP_ENV, healthy: d1 && r2, checks: { d1, r2 } }, d1 && r2 ? 200 : 503);
}

export type AccessIdentityResolver = (request: Request, env: Env) => Promise<StaffIdentity | null>;

export function failClosedAdminHandler(resolveIdentity?: AccessIdentityResolver) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    if (!resolveIdentity) return new Response("Not found", { status: 404 });

    const identity = await resolveIdentity(request, env).catch(() => null);
    if (!identity) return new Response("Unauthorized", { status: 401 });
    return new Response("Forbidden", { status: 403 });
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/__ops/smoke" && url.search === "") return smoke(request, env);
    return new Response("Not found", { status: 404 });
  },
};
