// Real, loopback-only PostgreSQL with a fresh cluster per run. Never accepts a URL.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const probe = net.createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const databaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextap-inventory-pg-"));
const cluster = new EmbeddedPostgres({ databaseDir, port, password: randomBytes(24).toString("hex"), persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"], onLog() {}, onError() {} });
const clients = [];
const owner = "00000000-0000-4000-8000-000000000001";
async function connect(asOwner = true) {
  const client = cluster.getPgClient("postgres", "127.0.0.1"); await client.connect(); clients.push(client);
  if (asOwner) { await client.query("set role authenticated"); await client.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]); }
  return client;
}
async function batch(client, name, quantity = 2, key = randomUUID()) {
  const { rows } = await client.query("select public.create_card_batch($1,$2,$3,$4) as b", [name, quantity, key, Array.from({ length: quantity }, () => randomBytes(24).toString("base64url"))]);
  return rows[0].b;
}
async function preview(client, bid) { return (await client.query("select public.preview_card_deletion(null,$1) as p", [bid])).rows[0].p; }
async function commit(client, p) { return (await client.query("select public.commit_card_deletion($1,true,true,$2) as r", [p.operationId, p.batchCode])).rows[0].r; }
try {
  await cluster.initialise(); await cluster.start();
  const admin = await connect(false);
  await admin.query(await fs.readFile("scripts/database/test-bootstrap.sql", "utf8"));
  for (const file of (await fs.readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    if (file.endsWith("_contacts.sql")) {
      await admin.query("insert into public.businesses(id,name,category) values('00000000-0000-4000-8000-000000000010','Upgrade QA','QA'); insert into public.business_pages(id,business_id,slug,template) values('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000010','upgrade-qa','professional');");
    }
    await admin.query(await fs.readFile(`supabase/migrations/${file}`, "utf8"));
  }
  assert.deepEqual((await admin.query("select contact_config from public.business_pages where slug='upgrade-qa'")).rows[0].contact_config,{});
  console.log("PASS real PostgreSQL: representative pre-contact draft survives upgrade with Contacts off");
  await admin.query("insert into auth.users values($1),('00000000-0000-4000-8000-000000000002');", [owner]);
  await admin.query("insert into public.owner_users(user_id) values($1)", [owner]);
  await admin.query(await fs.readFile("supabase/tests/inventory-deletion.sql", "utf8"));
  const a = await connect(), b = await connect();
  await admin.query(await fs.readFile("supabase/tests/contacts.sql", "utf8"));
  const contactBusiness = randomUUID(), contactPage = randomUUID();
  await a.query("insert into public.businesses(id,name,category) values($1,'Contact race','QA')", [contactBusiness]);
  await a.query("insert into public.business_pages(id,business_id,slug,template) values($1,$2,'contact-race','professional')", [contactPage,contactBusiness]);
  const contactDraft = { businessId:contactBusiness,pageId:contactPage,name:"Contact race",category:"QA",archived:false,slug:"contact-race",template:"professional",providerProfiles:{},sections:[{key:"hero",kind:"hero",title:"",position:0,enabled:true,content:{}}],contact:{enabled:true,displayName:"Contact race",organization:"QA",primaryPhone:"01012345678",fields:[]} };
  const saves = await Promise.allSettled([a,b].map(client => client.query("select public.save_contact_draft($1,0,0,true)",[contactDraft])));
  assert.equal(saves.filter(result => result.status === "fulfilled").length,1);
  assert.equal(saves.find(result => result.status === "rejected").reason.code,"40001");
  assert.equal((await a.query("select count(*)::int n from public.page_publications where page_id=$1",[contactPage])).rows[0].n,1);
  console.log("PASS real PostgreSQL: contact contracts and concurrent save/publish reject stale writer");
  const batches = (await Promise.all([a,b].map(async (client, lane) => {
    const results=[];
    for (let i=0;i<6;i++) results.push(await batch(client, `Concurrent ${lane}-${i}`,3));
    return results;
  }))).flat();
  const serials = (await a.query("select serial from public.cards")).rows.map(r => r.serial);
  assert.equal(new Set(serials).size, 36);
  const key = randomUUID();
  const retries = await Promise.all([batch(a, "Same request", 2, key), batch(b, "Same request", 2, key)]);
  assert.equal(retries[0].id, retries[1].id);
  const target = batches[0]; const p = await preview(a, target.id);
  const card = (await a.query("select id from public.cards where batch_id=$1 limit 1", [target.id])).rows[0].id;
  await a.query("begin");
  await a.query("select public.assign_card($1,null,'disabled','deactivation')", [card]);
  const waitingDelete = commit(b, p).then(() => "unexpected", e => e.code);
  // Assert contention via pg_stat_activity rather than sleeping to assume it.
  await waitForLock(admin, b.processID);
  await a.query("commit");
  assert.equal(await waitingDelete, "40001");
  const fresh = await preview(a, target.id);
  const deletions = await Promise.all([commit(a, fresh), commit(b, fresh)]);
  assert.deepEqual(deletions[0], deletions[1]);
  assert.equal((await a.query("select count(*)::int as n from public.audit_logs where action='inventory.delete' and details->>'requestId'=$1", [fresh.operationId])).rows[0].n, 1);
  // Audit failure occurs after operational deletes: the transaction must restore all.
  const rollbackTarget = batches[1], rollbackPreview = await preview(a, rollbackTarget.id);
  await admin.query("create function private.fail_delete_audit() returns trigger language plpgsql as $$ begin if new.action='inventory.delete' then raise exception 'injected audit failure'; end if; return new; end $$; create trigger fail_delete_audit before insert on public.audit_logs for each row execute function private.fail_delete_audit();");
  await assert.rejects(commit(a, rollbackPreview), /injected audit failure/);
  assert.equal((await a.query("select count(*)::int as n from public.cards where batch_id=$1", [rollbackTarget.id])).rows[0].n, 3);
  await admin.query("drop trigger fail_delete_audit on public.audit_logs; drop function private.fail_delete_audit();");
  await commit(a, rollbackPreview);
  console.log("PASS real PostgreSQL: SQL security contracts; concurrent issuance; creation retry; assignment/delete contention; delete/delete receipt; audit-failure rollback");
} catch (error) { console.error(`Real PostgreSQL validation failed: ${error.message}`); process.exitCode = 1; }
finally {
  await Promise.allSettled(clients.map(client => client.end()));
  await cluster.stop();
  // Only this run's freshly created temp cluster is eligible for cleanup.
  if (path.dirname(databaseDir) === os.tmpdir() && path.basename(databaseDir).startsWith("nextap-inventory-pg-")) await fs.rm(databaseDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
async function waitForLock(admin, pid) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const { rows } = await admin.query("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Expected concurrent transaction did not wait for a lock");
}
