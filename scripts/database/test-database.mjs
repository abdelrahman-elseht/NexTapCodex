// Disposable, in-memory PostgreSQL. Never connects to a hosted database.
// Auth/Storage schemas are minimal test scaffolding, not a Supabase service emulator.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema extensions; create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  `);
  const migrations = (await fs.readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await db.exec(await fs.readFile(`supabase/migrations/${file}`, "utf8"));
    console.log(`Applied ${file}`);
  }
  await db.exec(`
    insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
    insert into public.owner_users(user_id) values ('00000000-0000-4000-8000-000000000001');
  `);
  for (const file of process.argv.includes("--cache-only") ? [] : ["phase123-contracts.sql", "phase5-incremental-saves.sql", "phase6-publication-cache.sql", "preprod-publication-security.sql"]) {
    const results = await db.exec(await fs.readFile(`supabase/tests/${file}`, "utf8"));
    for (const result of results) for (const row of result.rows) for (const [key, value] of Object.entries(row)) {
      if (typeof value === "boolean") assert.equal(value, true, `${file}: ${key}`);
    }
    console.log(`Passed ${file}`);
  }
  // Calling both wrappers as anon catches missing privileges on their private callees.
  await db.exec("set role anon");
  assert.equal((await db.query("select public.get_publication_pointer('missing') as pointer")).rows[0].pointer, null);
  assert.equal((await db.query("select public.get_publication_snapshot('00000000-0000-4000-8000-000000000003') as snapshot")).rows[0].snapshot, null);
  await db.exec("reset role");
  console.log(`PASS: ${migrations.length} migrations, SQL contracts, anonymous publication RPC execution`);
} catch (error) {
  console.error(`Database validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
